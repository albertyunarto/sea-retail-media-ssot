# Implementation Roadmap — Measurement Framework §5 Future Work

**Status:** living plan · **Companion to:** [`measurement_framework.md`](./measurement_framework.md)

This doc sequences the four build items in the charter's §5 Future Work
into three ship-able phases. Each phase is a single commit / PR.

## Scope decisions (locked)

- **Direct vs broad on non-Shopee channels.** `direct_gmv_usd` and
  `broad_gmv_usd` are populated on every row. For Shopee ads, direct
  and broad differ (direct = last-click; broad = direct + view-assisted).
  For TikTok Ads / Meta CPAS / Google Ads, both columns duplicate
  `ads_attributed_gmv_usd` (the single reported figure) so the dashboard
  does not branch on platform. Organic rows carry NULL for both.
- **Backward compat.** `ads_attributed_gmv_usd` stays exactly as-is
  (broad-equivalent). New columns are additive.

## Dependencies

- Phase 1 ships first (data layer). No UI change — safe to merge and
  deploy standalone.
- Phase 2 requires Phase 1's columns; can't mock credibly without them.
- Phase 3 is standalone logic but gets the most user value inside the
  Phase 2 view.

---

## Phase 1 — Data-layer foundation  (~1 day, single commit)

**Goal:** land `is_mega_sale` + `direct_gmv_usd` + `broad_gmv_usd` on
both mart panel variants (`mart.daily_channel_panel` and
`mart.daily_channel_panel_evc`) so Phase 2 has nothing blocking it.

### New files

- `sql/seeds/05_seed_calendar_events.sql` — a new seed table
  `seeds.seed_calendar_events (date, market, event_name, event_kind)`.
  Enumerates 11.11, 12.12, 9.9, 3.3, 4.4 across all six markets; plus
  Harbolnas (ID / PH), Lebaran / Hari Raya (ID / MY), Songkran (TH),
  Tet (VN), CNY (SG / MY / VN / PH / TH), Christmas week (SG / MY / PH).
  Range: 2025-10-01 → 2026-12-31 to match the demo horizon.
- `sql/verify/11_mega_sale_flag_matches_calendar_seed.sql` —
  invariant: `is_mega_sale = TRUE` in the panel iff `(date_local, market)`
  exists in the seed.
- `sql/verify/12_direct_leq_broad.sql` — invariant: per row,
  `direct_gmv_usd <= broad_gmv_usd` (broad = direct + view-assisted).

### Edits

- `sql/mart/01_daily_channel_panel.sql`
  - `on_platform` CTE: add `SUM(direct_gmv_usd)` and `SUM(broad_gmv_usd)`.
  - `off_platform` CTE: emit both columns as duplicates of
    `purchase_value_reported_usd`.
  - `organic` CTE: `CAST(NULL AS NUMERIC)` for both.
  - Carry both columns through `unioned` + final SELECT.
  - `LEFT JOIN seeds.seed_calendar_events` by `(date_local, market)`,
    project `ce.date IS NOT NULL AS is_mega_sale`.
- `sql/evc/03_mart_daily_channel_panel_evc.sql` — the EVC mart
  enumerates columns explicitly (not `SELECT *`), so mirror the three
  new columns in its SELECT list.
- `dashboard/lib/types.ts` — extend `PanelRow` with
  `direct_gmv_usd?`, `broad_gmv_usd?`, `is_mega_sale?`.
- `dashboard/lib/bq.ts` — add the three columns to the SELECT.
- `dashboard/lib/mock-panel.ts` — populate:
  - Shopee ads channels: `direct_gmv_usd = adsGmv * 0.55`,
    `broad_gmv_usd = adsGmv` (broad > direct).
  - Other ad channels: `direct = broad = adsGmv`.
  - Organic: NULL for both.
  - `is_mega_sale = TRUE` on 2025-11-11, 2025-12-12, 2026-03-03, and
    market-specific Harbolnas / Lebaran dates.

### Verification

- `ssot bootstrap && ssot transform --stage seeds,mart,evc` succeeds.
- `gen-data verify` returns **12/12 pass** (10 existing + 2 new).
- Dashboard mock smoke shows the three new columns populated.
- `next build` + `tsc --noEmit` clean.

---

## Phase 2 — `/daily-report` view  (~2–3 days, single commit)

**Goal:** build the canonical daily report from Charter §4 as a new
route with its own masthead nav tab.

### New files

- `dashboard/app/daily-report/page.tsx` — Server Component; parses
  filters, calls `getPanel()`, renders `<DailyReport />`.
- `dashboard/components/daily-report.tsx` — top-level layout.
- `dashboard/components/charts/dual-axis.tsx` — extension of
  `LineChart` with right-axis channel-stacked columns.
- `dashboard/components/charts/share-comparison.tsx` — paired
  horizontal bars for share-of-spend vs share-of-GMV with a divergence
  badge (fires when `|spend_share − gmv_share| > 0.05`).
- Four section components under `dashboard/components/daily-report/`:
  - `section-spend-vs-gmv.tsx` — Charter §4.1
  - `section-share-divergence.tsx` — Charter §4.2
  - `section-attribution-roas.tsx` — Charter §4.3 (Shopee direct + broad
    side-by-side; TT / Meta `7d_click`; Google `all_conversions`;
    footnotes)
  - `section-promo-overlay.tsx` — Charter §4.4 (legend strip; overlay
    markers live inside §4.1's chart)

### Edits

- `dashboard/components/masthead.tsx` — insert a `Daily Report` NavTab
  between `Overview` and `Advanced`.

### Reuse (no new primitives)

`LineChart`, `StackedColumns`, `Sparkline` from `components/charts/`.
`KPI`, `SectionHead`, `Tag`, `ghostBtn` from `components/primitives.tsx`.
`aggKPIs`, `filterPanel`, `applyEvc`, `computeWeeklyStory` from
`lib/aggregations.ts`. Mobile utilities `.stack-tablet`,
`.scroll-x-mobile`, `.cols-2-mobile`, `.pad-responsive` from
`app/globals.css`.

### Verification

- `/daily-report` returns 200 in mock + real-BQ mode.
- Divergence badge fires on at least one channel at seed=42.
- Promo overlay shows 11.11 on all 6 markets; Ramadan on ID + MY only.
- `/daily-report` route size < 20 kB first-load.
- Mobile (375 px): every section scans without horizontal page scroll
  (charts scroll internally via `.scroll-x-mobile`).

---

## Phase 3 — Data-issue anomaly flag  (~half day, single commit)

**Goal:** ship the "verify before reallocating" guard-rail from
Charter §4.3 across both the main dashboard and the daily report.

### Edits

- `dashboard/lib/aggregations.ts` — extend `AnomalyLevel` union to
  `"spike" | "slump" | "data_issue" | "healthy"`. In `computeAnomaly()`,
  fire `data_issue` when `abs(roasShiftPct) > 0.25 && spendNow > 1000`.
  Return early so it outranks `spike` / `slump`.
- `dashboard/components/main-dashboard.tsx` — amber chip + `⚠` icon
  for `data_issue`; tooltip: "ROAS moved >25% WoW. Verify the tag /
  ingest window before re-allocating budget."
- `dashboard/components/daily-report/section-attribution-roas.tsx` —
  same chip in the ROAS table, same copy.

### New files

- `dashboard/__tests__/anomaly.test.ts` — optional unit tests
  covering all four anomaly levels. Deferrable if adding a test
  harness is out-of-scope at commit time — document as a follow-up.

### Verification

- Unit tests green (or manual smoke if deferred).
- Mock panel renders at least one `data_issue` flag at seed=42.
- Hover reveals the correct copy.

---

## Explicit non-goals across all three phases

- **No causal-impact notebooks or MMM runs.** Charter §2.3 / §2.4
  describe how the panel feeds them — actual analyses are separate
  work.
- **No `config/sim/events.yaml` generator integration.** Phase 1
  hardcodes event dates in SQL; surfacing them in the Python
  `seasonality.yaml` is later refinement.
- **No auth / PDF export / scheduled-email on the daily report.**
- **No breaking changes to `ads_attributed_gmv_usd`.** It stays as
  the default broad-equivalent column for backward compat.
