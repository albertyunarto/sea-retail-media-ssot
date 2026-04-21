# SEA Retail Media SSOT — Measurement Framework

**Status:** charter (living document) · **Audience:** DTLs, analytics
leads, measurement consultants onboarding to the project

This is the single source of truth for **what the SSOT is built to
measure** and **how** that measurement surfaces. If you're new, read
this in one pass before opening any of the other PRDs — it pins down
scope, modeling goals, source inventory, and the canonical daily-report
view all the downstream work aims at.

## 1. Scope

**Markets (6):** Indonesia, Thailand, Vietnam, Malaysia, Singapore,
Philippines (ID / TH / VN / MY / SG / PH). Canonical market metadata
(timezone, currency) lives in `sql/seeds/01_dim_market.sql`.

**Anchor platforms:** Shopee + TikTok Shop. Off-platform ad platforms
(Google Ads, Meta CPAS) point at Shopee as their destination platform.

**Time horizon:** a rolling **12–18 months of daily history** is
required to support the MMM goal (§2.4). All modeling consumers
operate at daily grain and can aggregate to weekly where they prefer.

## 2. Modeling goals

The panel (`mart.daily_channel_panel` + `mart.daily_channel_panel_evc`)
is built to feed four named consumers. Every staging, fact, and mart
decision flows from these:

### 2.1 Daily spend + conversion visibility

By `market × channel`, with **reconciled totals at the platform level**.
This is what the dashboard and the sample daily report (§4) render.

SSOT invariant, held by PRD-A's simulation:
`SUM(ads_attributed_gmv_usd) ≤ platform_total_gmv_usd` within 5 %
tolerance, per `(date_local, market, anchor_platform)`. This is the
reconciliation guarantee — ads-attributed GMV cannot exceed what
actually landed on the platform.

### 2.2 Multivariate regression

Daily or weekly. The benchmark measurement approach before graduating
to full MMM:

- **Target:** `log(platform_total_gmv_usd + 1)` — log to stabilize
  variance, `+1` to handle zero days.
- **Covariates:**
  - `log(1 + spend_usd)` per channel (handles zero-spend days + the
    concave response shape cheaply without a full MMM).
  - `impressions` per channel (optional second lever where spend
    efficiency masks inventory changes).
  - `is_weekend`, `is_payday`, `is_mega_sale` (future — see §5),
    `week_of_year`.

Produces marginal-contribution coefficients per channel that can be
interpreted directly by a measurement lead. Serves as the regression
baseline the MMM output should beat or explain.

### 2.3 Causal impact studies

BSTS (Google Causal Impact) on three experiment shapes:

- **Geo holdouts** — turn a channel off in one market for 4+ weeks;
  use the other 5 markets as controls. Panel already supports this
  by construction (market is a panel dimension).
- **Campaign on/off switches** — pause a specific campaign for a
  week; use its own pre-period as the control with seasonality
  adjusted. Needs campaign-grain facts (`fact.fact_onplatform_ads` /
  `fact.fact_offplatform_ads` already carry `campaign_id`).
- **Seasonal lift vs counterfactual** — measure mega-sale uplift
  (11.11, 12.12, Harbolnas, Lebaran) against a synthetic baseline
  built from matched non-sale weeks in the same market. Depends on
  the future `is_mega_sale` flag (§5).

### 2.4 Light MMM (Meridian or Robyn)

Full time × geo × channel MMM over 12–18 months of daily history.
Channel-specific priors:

- **Adstock** — geometric decay with a configurable half-life per
  channel.
- **Hill saturation** — with ec50 (point of half-saturation) and
  shape (curvature) per channel.

Reference priors are declared in `config/sim/priors.yaml` and emitted
alongside generated data as `mmm_ground_truth.yaml` (PRD-A Should-Have
#4), so demo-mode MMM runs can score recovered coefficients against
the true values.

## 3. Source inventory

Six Supermetrics connectors plus a custom-API extension for EVC. All
declared in `config/sources.yaml`; EVC DDLs in `sql/ddl/07-09_raw_evc_*.sql`.

| Connector | ds_id | Grain | Raw table |
|---|---|---|---|
| Google Ads (Shopee) | AW | daily × campaign × ad_group × keyword | `raw_supermetrics.google_ads_shopee_daily` |
| Shopee Ads | SHPA | daily × ad_type × campaign × sku × keyword | `raw_supermetrics.shopee_ads_daily` |
| Shopee Commerce | SHP | order-line | `raw_supermetrics.shopee_orders` |
| TikTok Shop | TTS | order-line | `raw_supermetrics.tiktok_shop_orders` |
| TikTok Ads | TT | daily × campaign × ad_group × ad | `raw_supermetrics.tiktok_ads_daily` |
| Meta CPAS | FA | daily × adset × ad | `raw_supermetrics.meta_cpas_daily` |

EVC extension (direct platform APIs, bypasses Supermetrics):
`raw_custom_apis.evc_google`, `raw_custom_apis.evc_meta`,
`raw_custom_apis.evc_tiktok`.

## 4. Sample daily report — canonical view

The shareable daily read for a campaign or measurement lead. Designed
for use at `/daily-report` (future route — see §5). Four sections,
each answers one named question:

### 4.1 Spend vs platform GMV (dual-axis, daily, by market, channel-stacked)

Answers **"is investment tracking with return?"**

- Left axis: platform GMV (line) — `platform_total_gmv_usd`,
  de-duplicated per `(date, market, platform)`.
- Right axis: working spend stacked by channel (columns).
- One chart per market (small-multiples) or a single chart with the
  global market filter applied.

Reading: when GMV and spend move together, the channel mix is healthy.
When spend rises and GMV stays flat, you're buying yield that isn't
materializing — look at §4.2 next.

### 4.2 Share of spend vs share of GMV (channel mix)

Answers **"where is the wallet over-concentrated relative to return?"**

Paired bars for each channel: share of working spend vs share of
ads-attributed GMV. Watch for **divergence** — if a channel's
share-of-spend is creeping up while its share-of-GMV is flat or
falling, the channel is saturating. This is the headline signal for
reallocation.

### 4.3 Reported ROAS by channel

Answers **"is each channel pulling its weight on its own terms?"**

Each platform reports on a different attribution window; the view
surfaces all of them side-by-side with footnotes so the numbers are
comparable rather than mashed into a single blended figure:

- **Shopee:** show **direct** and **broad** ROAS side-by-side.
  Direct = last-click within the platform. Broad = direct + view-assisted.
- **TikTok Ads / Meta CPAS:** **7d_click** (Meta dropped 7d_view /
  28d_view in January 2026 — see EVC extension for the residual
  view-assisted signal).
- **Google Ads:** **all_conversions** (Google's default, includes
  view-through).

**Data-issue-first heuristic:** any channel with a WoW ROAS swing
> 25 % is flagged as a **data issue first**, performance issue second.
The surface copy reads "verify the tag / ingest window before
re-allocating budget." This rule exists because attribution-window
deprecations, tag drops, and ingest-pipeline lag are more common in
retail media than real 25 % performance shifts week-over-week.

### 4.4 Promo overlay

Answers **"how much of this week is promo, not signal?"**

Payday (`is_payday`) markers and mega-sale (`is_mega_sale`, future)
markers drawn directly on the GMV line from §4.1. A mega-sale spike
without a payday spike is real demand; both together can mean
phantom performance if the promo window includes heavy voucher
subsidy.

## 5. Future work surfaced by this framework

Items below are captured here so they have a home — not committed as
sprint scope. Each references the specific file / mart object a build
would touch.

- **`is_mega_sale` flag on `mart.daily_channel_panel`.** New seed
  `sql/seeds/05_seed_calendar_events.sql` enumerating 11.11, 12.12,
  9.9, 3.3, 4.4, Harbolnas, Lebaran, per market; join into the panel
  during mart build. Unblocks §2.2 covariate, §2.3 seasonal lift, and
  §4.4 overlay.
- **Direct vs broad ROAS in the mart.** Today
  `mart.daily_channel_panel.ads_attributed_gmv_usd` carries broad for
  Shopee. Add `direct_gmv_usd` + `broad_gmv_usd` columns sourced from
  `fact.fact_onplatform_ads.{direct_gmv_usd, broad_gmv_usd}`.
  Unblocks §4.3.
- **`/daily-report` route** in the dashboard. Reuses existing
  `LineChart` + `StackedColumns` primitives; needs a new
  share-of-spend-vs-share-of-GMV bar comparison component
  (`components/charts/share-comparison.tsx`).
- **25 % WoW swing data-issue flag.** Extend
  `computeAnomaly()` in `dashboard/lib/aggregations.ts` with a
  `data_issue` level; surface distinctly from the existing
  `spike` / `slump` / `healthy`. Powers §4.3 data-issue-first copy.

## References

- **PRD-A** (simulation generator): `docs/simulation.md`
- **PRD-B** (demo dashboard): `dashboard/README.md`
- **Repo README:** top-level `README.md`
- **Panel DDL:** `sql/mart/01_daily_channel_panel.sql`
- **Panel + EVC DDL:** `sql/evc/03_mart_daily_channel_panel_evc.sql`
- **Taxonomy:** `config/taxonomy.yaml` + `sql/seeds/03_seed_channel_taxonomy.sql`
- **Markets:** `config/markets.yaml` + `sql/seeds/01_dim_market.sql`
- **Sources:** `config/sources.yaml`
- **Sim priors:** `config/sim/priors.yaml`
