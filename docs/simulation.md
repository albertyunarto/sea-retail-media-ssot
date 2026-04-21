# Simulation Data Generator (`ssot.sim`)

Reproducible synthetic data generator for the SEA retail-media SSOT pipeline.
Produces coherent, connector-accurate, EVC-aware marketing data for the
fictional SEA CPG brand **Elysium Home Care** across 6 markets and 6 data
sources (plus 3 EVC custom-API extensions). See PRD-A for the narrative.

> **Feeds** the measurement framework charter at
> [`docs/measurement_framework.md`](./measurement_framework.md) — same
> scope (6 SEA markets, Shopee + TikTok Shop anchors), same modeling
> goals (visibility, multivariate regression, causal impact, light MMM
> with adstock + Hill saturation). The ground-truth priors emitted
> alongside generated data (`mmm_ground_truth.yaml`) are the calibration
> target demo-mode MMM runs are scored against.

## When to use it

- You want to demo the full `sea-retail-media-ssot` stack end-to-end but have
  no live Supermetrics contract.
- You want to show the EVC-uplift story (reported-only vs EVC-adjusted)
  without real advertiser data.
- You want a reproducible, seed-deterministic dataset to benchmark MMM / Causal
  Impact against (an `mmm_ground_truth.yaml` ships alongside the data).

## Install

```bash
pip install -e ".[dev,sim]"   # adds numpy, scipy, pandas on top of the base deps
```

Installs a new CLI: `gen-data`.

## End-to-end: fresh GCP project → populated mart

```bash
export GCP_PROJECT=<your-demo-project>
export BQ_LOCATION=asia-southeast1

ssot bootstrap                                      # creates 6 datasets incl. raw_custom_apis
gen-data run --mode=bq --seed=42 --days=180         # generates + loads the 6 raw tables + 3 EVC
ssot transform --stage staging,fact,mart,evc        # runs the full transform chain
gen-data verify                                     # 10 invariant SQLs — expect 10/10 PASS
```

Expected timing:
- `gen-data run`: ~40 seconds for the 180d × 6m horizon.
- `ssot transform`: depends on BQ slot availability, typically 1-2 minutes.
- `gen-data verify`: ~10 seconds.

Expected volumes:
- `mart.daily_channel_panel`: ~180 × 6 × 11 ≈ 12k rows.
- `mart.daily_channel_panel_evc`: same grain plus EVC columns.
- Raw order-line tables (`shopee_orders`, `tiktok_shop_orders`): ~1-2M rows
  combined. The generator deliberately picks demo-scale volumes, not full
  production scale — see `config/sim/priors.yaml` to scale up.

## Two output modes

**`--mode=bq`** (default) — loads directly into the raw tables in BigQuery,
bypassing the Supermetrics API entirely. Fastest path for demo setup.

**`--mode=supermetrics`** — writes NDJSON files laid out exactly like what
the real Supermetrics extractor would produce:
```
<output>/
  tiktok_shop/<market>/<YYYY-MM-DD>.ndjson
  tiktok_ads/<market>/<YYYY-MM-DD>.ndjson
  ...
```
You can then replay them into BigQuery with:
```bash
gen-data ingest --input=./sim-output --project=$GCP_PROJECT
```
Both modes produce byte-identical `raw_supermetrics.*` tables for the same
seed.

**`--mode=both`** — produce both outputs in a single run.

## Subcommands

| Command | Purpose |
|---|---|
| `gen-data run` | Generate data end-to-end |
| `gen-data evc` | Regenerate EVC custom-API tables only |
| `gen-data ingest` | Replay NDJSON from disk into BQ |
| `gen-data verify` | Run the 10 invariant SQLs |
| `gen-data scenarios list` | List pre-built scenario overlays |
| `gen-data scenarios apply --name X` | Preview what a scenario would patch |
| `gen-data init` | Scaffold `config/sim/*.yaml` (v1 ships pre-populated) |

## Scenarios

Applied with `gen-data run --scenario <name>` to overlay a narrative onto
the base timeline. Six ship out of the box:

| Scenario | Narrative |
|---|---|
| `competitor_launch` | Rival brand cuts prices — ROAS compresses ~20% |
| `supply_shortage` | Stockouts halve organic platform GMV |
| `algo_change` | Platform algorithm update drops TikTok Ads CTR by 30% |
| `viral_moment` | Organic TikTok Shop spikes +200% |
| `price_war` | Category-wide discounting; CVR lifts 15% |
| `category_headwind` | Beauty category demand dips 25% |

Add your own by extending `config/sim/scenarios.yaml`.

## EVC (Engaged-View Conversion) story

Three new raw tables land in the `raw_custom_apis` dataset, shaped to mirror
what a direct Google / Meta / TikTok API pull would return:

- `raw_custom_apis.evc_google` — `ad_event_type` enum matching Google's
  `segments.ad_event_type` (click_through / engaged_view / view_through).
- `raw_custom_apis.evc_meta` — `attribution_window` in
  `{1d_click, 7d_click, 1d_view, 1d_ev}`. Post-January-2026 the deprecated
  `7d_view` / `28d_view` windows are NEVER emitted.
- `raw_custom_apis.evc_tiktok` — `attribution_type` in `{CTA, VTA, EVTA}`
  with configurable window (1 / 7 / 28 days).

Downstream, `sql/evc/01_stg_evc.sql` unifies these into a long
`(date, market, channel, attribution_bucket, conversions)` shape;
`mart.daily_channel_panel_evc` widens this onto `daily_channel_panel` so
the dashboard can toggle EVC on/off (PRD-B §5).

Invariant by construction: `evc_conversions <= all_conversions` per row.
EVC is derived from the engine's `all_conversions` via a Binomial draw, so
this cannot be violated regardless of seed or scenario.

## Seeding & reproducibility

Every RNG in the engine is derived from `--seed` via named substreams
(`PCG64.jumped(hash(label))`), so:

- Two runs with `--seed=42` produce byte-identical NDJSON.
- Changing `--seed` produces different-but-still-valid data.
- Refactoring the engine to reorder draws does NOT perturb individual streams.

## Ground-truth emission

When `--output` is set, `mmm_ground_truth.yaml` lands alongside the NDJSON,
documenting the **true** adstock half-life, Hill shape, baseline ROAS, and
EVC coverage per channel. Use it to score MMM recovery ("Meridian recovered
5.4x; ground truth was 5.5x").

## Configuring the brand

Four YAMLs drive the brand shape:

- `config/sim/brand.yaml` — 4 categories × 8 SKUs (Elysium Home Care).
- `config/sim/priors.yaml` — per-channel adstock/Hill/ROAS/funnel + EVC.
- `config/sim/seasonality.yaml` — DoW × payday × event windows (Ramadan,
  11.11, 12.12, Harbolnas, CNY, Hari Raya, Songkran).
- `config/sim/scenarios.yaml` — named overlays.

Edit these freely. The CLI `--markets` and `--sources` flags subset the run.

## Safety

- Every generated row carries `_source_system = <source>_sim`. Downstream
  consumers can filter these out with `WHERE _source_system NOT LIKE '%_sim'`
  if they want to mix real + simulated data.
- The generator is pure simulation. No real advertiser data is used, and no
  attempt is made at differential privacy or GAN-based synthesis from real
  seeds. It is safe to share generated datasets publicly.
