# Simulation data — CSV reference sample

Flat CSV snapshot of the `ssot.sim` generator output at `--seed=42 --days=7`
(2026-04-13 → 2026-04-19, inclusive). One CSV per Supermetrics connector,
all six markets (ID / TH / VN / MY / SG / PH) concatenated, with the
field order matching `config/sources.yaml` so it's shape-equivalent to
what the real Supermetrics extractor would return.

Ready to drop into Google Sheets, Google Drive, or any Supermetrics
CSV / Sheets data source.

## What's in the folder

| File | Rows | Grain | Size |
|---|---|---|---|
| `tiktok_shop.csv` | ~6,000 | order-line (TTS) | ~1.5 MB |
| `tiktok_ads.csv` | ~700 | daily × campaign × ad_group × ad (TT) | ~220 KB |
| `shopee_commerce.csv` | ~116,000 | order-line (SHP) | ~33 MB |
| `shopee_ads.csv` | ~10,000 | daily × ad_type × campaign × sku × keyword (SHPA) | ~2.3 MB |
| `meta_cpas.csv` | ~700 | daily × adset × ad (FA) | ~210 KB |
| `google_ads_shopee.csv` | ~800 | daily × campaign × ad_group × keyword (AW) | ~210 KB |
| `mmm_ground_truth.yaml` | — | MMM priors used by the engine | ~1.5 KB |

Each row carries the Supermetrics enrichment block in the right-hand
columns: `_source_system`, `_market`, `_accounts`, `_window_start`,
`_window_end`. `_source_system` ends in `_sim` so these rows are
distinguishable from real data if the two ever co-mingle.

## Import paths

### Option A — Supermetrics via Google Sheets

1. In Google Sheets, `File → Import → Upload` the CSV (or use
   `=IMPORTDATA("https://raw.githubusercontent.com/<owner>/sea-retail-media-ssot/main/data/sim-csv/<connector>.csv")`
   for a live link).
2. In the Supermetrics sidebar add a new query against the sheet using
   the **"Google Sheets"** source (one query per connector tab).
3. Map the columns — the header row already uses Supermetrics-native
   field names (`Date`, `Spend`, `Impressions`, etc.), so the mapping
   is 1:1.
4. Set the date field to `Date`, schedule as needed.

### Option B — Supermetrics via Drive (CSV file)

1. Upload each CSV to Google Drive.
2. In Supermetrics, create a **"CSV file"** data source per connector
   pointing at the Drive path.
3. Header row is detected automatically; all fields match the
   corresponding connector's native schema.

### Option C — Direct load to BigQuery

If you're running the full SSOT pipeline, skip the CSV path and
regenerate straight into BigQuery:

```bash
gen-data run --mode=bq --seed=42 --days=180 --project=$GCP_PROJECT
ssot transform --stage staging,fact,mart,evc
```

This is the demo path PRD-A §10 documents.

## Regenerate with a different window

```bash
cd <repo-root>
gen-data run --mode=csv --seed=42 --days=30 --output=./my-sim-csv
```

- `--days` accepts any positive integer. 180 is the full-year demo
  horizon the dashboard is tuned for; files get large (~700 MB total
  at 180 days, driven by `shopee_commerce.csv`) — keep those local,
  don't commit.
- `--seed` keeps output byte-identical across runs. Change it to get
  a different but equivalently shaped dataset.
- `--markets=ID,TH` to narrow to a subset; `--sources=tiktok_ads,shopee_ads`
  to narrow to specific connectors.

## Narrative lock (so you know what you're looking at)

Same priority ordering as the Python simulation generator and the
dashboard:

1. **Shopee Ads** (5 sub-channels combined) — largest wallet bucket.
2. **Google Ads → Shopee** — hero accent, highest ROAS (~5.3× over
   the window on seed=42).
3. **Meta CPAS** — efficient mid-tier (~4.8×).
4. **TikTok Ads** — intentionally small, sub-1× ROAS.

Organic (Shopee + TikTok Shop) has no spend — it's the baseline on
the GMV side of the panel.

## Referenced from

- [`docs/measurement_framework.md`](../../docs/measurement_framework.md) — scope + modeling goals
- [`docs/simulation.md`](../../docs/simulation.md) — full PRD-A (ssot.sim)
- [`dashboard/README.md`](../../dashboard/README.md) — PRD-B
