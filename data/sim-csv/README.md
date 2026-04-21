# Simulation data — CSV reference sample

Flat CSV snapshot of the `ssot.sim` generator output at `--seed=42 --days=7`
(2026-04-13 → 2026-04-19, inclusive). One CSV per Supermetrics connector,
all six markets (ID / TH / VN / MY / SG / PH) concatenated, with the
field order matching `config/sources.yaml` so it's shape-equivalent to
what the real Supermetrics extractor would return.

These files also get copied into `dashboard/public/sim-csv/` at build
time so Vercel serves them at stable HTTPS URLs — that's the
Sheets-free path Supermetrics can ingest from.

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

## Ingesting into Supermetrics — HTTPS / URL source (no Sheets required)

This is the recommended path if your org blocks Google consumer
Sheets via privacy policy. The dashboard's Vercel deployment serves
each CSV as a static asset with `Content-Type: text/csv` at a stable
public URL, which Supermetrics' URL / Custom CSV source can fetch on
schedule.

### URL template

```
https://<your-dashboard>.vercel.app/sim-csv/<connector>.csv
```

For each of the 6 Supermetrics connectors, add one data source in
Supermetrics pointing at the URL above. Tier-specific source names:

| Supermetrics tier | Source to use |
|---|---|
| **Team** | `CSV` or `URL Fetch` source |
| **Enterprise** | `Custom CSV / Web URL` or `HTTP Request` connector |
| **Functions** | `SM.FetchURL()` with `text/csv` parser |

### Supermetrics setup (typical flow)

1. Add a new data source → "CSV from URL" (or equivalent for your tier).
2. Paste the URL for the first connector, e.g.
   `https://<your-dashboard>.vercel.app/sim-csv/tiktok_ads.csv`.
3. Let Supermetrics auto-detect the header row — column names already
   match Supermetrics' native field vocabulary (`Date`, `Spend`,
   `Impressions`, `Campaign_id`, etc.), so the mapping is 1:1 with
   no renames needed.
4. Set `Date` as the date field.
5. Choose BigQuery as the destination (or your preferred warehouse).
   Supermetrics will write to the raw schema Supermetrics uses by
   default; the simulated `_source_system`, `_market`, `_accounts`
   columns pass through as-is.
6. Repeat for the other 5 connectors. Schedule all at the same
   cadence (daily or on-demand — the CSVs don't change until you
   regenerate).
7. Use an `index.json` discovery manifest at
   `/sim-csv/index.json` to enumerate the available files
   programmatically.

### Verify the content type

```bash
curl -I https://<your-dashboard>.vercel.app/sim-csv/tiktok_ads.csv
# Content-Type: text/csv; charset=UTF-8
```

Vercel sets `text/csv` automatically based on the `.csv` extension —
no server-side code path, pure static asset with CDN caching, so
Supermetrics' scheduled pulls won't hammer any function-invocation
budget.

## Other ingest paths

### Direct BigQuery load (skip Supermetrics entirely)

```bash
gen-data run --mode=bq --seed=42 --days=180 --project=$GCP_PROJECT
ssot transform --stage staging,fact,mart,evc
```

This is the demo path PRD-A §10 documents. Supermetrics is bypassed
because the simulated data isn't coming from a real platform anyway.

### Local database / warehouse

The CSVs import cleanly into DuckDB, SQLite, or Postgres with the
native `COPY` / `\copy` commands — column types are inferred from the
header row. Useful for local prototyping before pushing to BQ.

```bash
# Example: DuckDB
duckdb sim.duckdb -c "CREATE TABLE tiktok_ads AS SELECT * FROM read_csv_auto('data/sim-csv/tiktok_ads.csv');"
```

## Regenerate with a different window

```bash
cd <repo-root>
gen-data run --mode=csv --seed=42 --days=30 --output=./data/sim-csv
cd dashboard && npm run build    # prebuild hook re-syncs public/sim-csv/
```

- `--days` accepts any positive integer. 180 is the full-year demo
  horizon the dashboard is tuned for; at that range the folder is
  ~700 MB (driven by `shopee_commerce.csv`) — keep large regens local,
  don't commit.
- `--seed` keeps output byte-identical across runs. Change it to get
  a different but equivalently shaped dataset.
- `--markets=ID,TH` narrows to a subset; `--sources=tiktok_ads,shopee_ads`
  narrows to specific connectors.

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
