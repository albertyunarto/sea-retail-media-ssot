# SEA Retail Media — Single Source of Truth

Supermetrics → BigQuery ELT covering **Shopee + TikTok Shop** retail media across SEA.
Designed to land three fact datasets (platform sales, on-platform ads, off-platform ads)
and a `mart.daily_channel_panel` shaped for Causal Impact / multivariate regression /
Meridian-style MMM.

See `docs/` for the architecture narrative (the `SEA_Retail_Media_SSOT.docx`).

## Stack at a glance

| Layer | Tech |
|---|---|
| Extract | Python 3.11 + Supermetrics Enterprise API |
| Load | BigQuery (`google-cloud-bigquery`) |
| Transform | BigQuery SQL, run by Python (no dbt) |
| Orchestration | Cloud Run Job + Cloud Scheduler |
| Secrets | GCP Secret Manager |
| CI | GitHub Actions (ruff + pytest) |
| Build & deploy | Cloud Build |

## Repo layout

```
.
├── src/ssot/
│   ├── main.py              CLI (ssot extract / extract-all / transform / run / bootstrap)
│   ├── supermetrics.py      API client with retries + pagination
│   ├── bq.py                BigQuery helper (load_json_rows, run_ddl_file)
│   ├── config.py            Pydantic config models (sources / markets / taxonomy)
│   ├── secrets.py           Secret Manager wrapper with env fallback
│   ├── transform.py         Runs SQL files in order (seeds → ddl → staging → fact → mart)
│   ├── logging_conf.py      JSON structlog for Cloud Run
│   └── extractors/          Per-source extractor registry (generic by default)
├── sql/
│   ├── ddl/                 6 raw-table DDLs (CREATE TABLE IF NOT EXISTS)
│   ├── seeds/               dim_market, dim_fx_rate, seed_channel_taxonomy, seed_traffic_source
│   ├── staging/             stg_platform_sales, stg_onplatform_ads, stg_offplatform_ads
│   ├── fact/                fact_platform_sales, fact_onplatform_ads, fact_offplatform_ads (MERGE)
│   └── mart/                daily_channel_panel (CREATE OR REPLACE TABLE)
├── config/
│   ├── sources.yaml         Supermetrics ds_id + field list per connector
│   ├── markets.yaml         Advertiser / shop IDs per market — FILL IN
│   └── taxonomy.yaml        Channel taxonomy reference (also enforced in SQL)
├── scripts/
│   └── bootstrap_gcp.sh     One-time GCP project setup (APIs, SA, secret, scheduler)
├── Dockerfile               python:3.11-slim, installs the package, entrypoint = ssot
├── cloudbuild.yaml          Build → Artifact Registry → deploy Cloud Run Job
├── pyproject.toml           Python deps + `ssot` CLI entry point
└── .github/workflows/ci.yml ruff + compileall + pytest
```

## Data model

```
raw_supermetrics.*                (bronze — append only, partitioned on ingested_at day)
     │
     ▼
stg.*                             (silver — CREATE OR REPLACE VIEW, dedup + TZ/FX/voucher normalize)
     │
     ▼
fact.fact_platform_sales          (gold — MERGE, daily × market × platform × shop × sku)
fact.fact_onplatform_ads          (gold — MERGE, daily × market × platform × ad_type × campaign)
fact.fact_offplatform_ads         (gold — MERGE, daily × market × platform × campaign)
     │
     ▼
mart.daily_channel_panel          (long table — feeds MMM / regression / Causal Impact)
```

Channels in the mart: `shopee_organic`, `shopee_ads_product_search`, `shopee_ads_shop_search`,
`shopee_ads_targeting`, `shopee_ads_gmv_max`, `tiktok_shop_organic`, `tiktok_shop_live`,
`tiktok_shop_video`, `tiktok_ads`, `meta_cpas`, `google_ads_shopee`.

## Local development

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'

cp .env.example .env
# fill in GCP_PROJECT, SUPERMETRICS_API_KEY (or configure gcloud ADC + Secret Manager)

# Pull one day for one source to smoke-test
ssot extract --source tiktok_ads --market ID --as-of 2026-04-18

# Run the transforms
ssot transform --stage staging,fact,mart

# End-to-end (extract every source + transform)
ssot run --as-of 2026-04-18
```

## Deploy (GCP)

```bash
export PROJECT_ID=your-project
export REGION=asia-southeast1
export JOB_NAME=ssot-daily
export REPO=ssot
bash scripts/bootstrap_gcp.sh        # one-time

# Push to main — Cloud Build trigger does:
#   docker build → push to Artifact Registry → gcloud run jobs deploy
git push origin main

# After first deploy, create datasets + DDL (idempotent):
gcloud run jobs execute "$JOB_NAME" --region="$REGION" --args=bootstrap

# Cloud Scheduler (created by bootstrap) triggers `ssot run` daily at 04:00 SGT.
```

### Secrets

One secret is required:

```bash
# Paste the Supermetrics API key interactively:
scripts/bootstrap_gcp.sh   # handles this
# Rotate later:
echo -n "NEW_KEY" | gcloud secrets versions add SUPERMETRICS_API_KEY --data-file=-
```

No service-account JSON is needed in the repo — Cloud Run uses the runtime SA via workload identity.

## Configuration you must fill in before first real run

These are the open items from §10 of the architecture doc:

1. `config/markets.yaml` — advertiser / shop / catalog IDs per market per platform (all empty by default).
2. `config/sources.yaml → meta_cpas → filter_expressions` — uncomment and populate `Catalog_id IN_LIST` once the brand provides Shopee/TikTok-Shop partner catalog IDs per market.
3. `config/sources.yaml → google_ads_shopee → filter_expressions` — adjust the `Campaign_name STARTS_WITH` prefix (default `SHP_`) to match your brand's convention for Demand Gen / Video campaigns that land on Shopee.
4. `sql/seeds/02_dim_fx_rate.sql` — replace the one-row placeholder with a daily FX backfill (scheduled query from a BQ public dataset, or a small adjacent pipeline).
5. `config/sources.yaml → ds_id` — confirm the Supermetrics data-source codes (`TT`, `TTS`, `SHP`, `SHPA`, `FA`, `AW`) match what your Supermetrics team contract exposes. Query the catalog endpoint to verify: `POST https://api.supermetrics.com/enterprise/v2/catalog`.

## Running the demo (no Supermetrics contract needed)

The `ssot.sim` sub-package generates reproducible synthetic data for the
fictional **Elysium Home Care** brand so the full pipeline can be demoed
end-to-end without a live Supermetrics account or real advertiser IDs.

```bash
pip install -e '.[dev,sim]'

export GCP_PROJECT=<your-demo-project>
ssot bootstrap                                     # creates datasets incl. raw_custom_apis
gen-data run --mode=bq --seed=42 --days=180        # ~40 s generation
ssot transform --stage staging,fact,mart,evc       # runs full transform + EVC stage
gen-data verify                                    # 10 invariant SQLs, expect 10/10 PASS
```

Outputs:
- `mart.daily_channel_panel` populated across 6 markets × ~11 channels × 180 days.
- `mart.daily_channel_panel_evc` — same grain plus EVC columns for the
  reported-vs-EVC-adjusted toggle story.
- `raw_custom_apis.evc_{google,meta,tiktok}` — Google / Meta / TikTok custom-API
  extension tables for EVC.

Full docs: [`docs/simulation.md`](docs/simulation.md).

### No BigQuery? Pull the CSVs straight into Supermetrics / Sheets

A committed 7-day reference sample lives at
[`data/sim-csv/`](data/sim-csv/) — one flat CSV per connector, fields
matching the native Supermetrics schema. Drop them into a Google
Sheet (`=IMPORTDATA(raw-url)`), point Supermetrics' CSV or Sheets
connector at them, and you have a data source for the dashboard
without ever touching BQ. Regenerate a longer window locally with
`gen-data run --mode=csv --days=30 --output=./my-sim-csv`. See the
folder's [README](data/sim-csv/README.md) for the full import flow.

## Measurement framework

`mart.daily_channel_panel` is the sole consumer-facing table. It's built to feed four named consumers: daily spend + conversion visibility, multivariate regression, causal-impact studies (geo holdouts, on/off switches, seasonal lift), and a light MMM over 12–18 months of history with adstock + Hill saturation priors.

The full charter — modeling goals, source inventory (6 Supermetrics connectors + EVC extension), the canonical daily-report spec (dual-axis spend vs GMV, share-of-spend vs share-of-GMV, attribution-noted ROAS, payday / mega-sale overlay), and the future-work queue — lives in **[`docs/measurement_framework.md`](docs/measurement_framework.md)**. Read it before onboarding onto analytics work.

## Runbook (1-pager)

- **Daily scheduled run** at 04:00 SGT reloads a rolling **T−14** window across all sources, then refreshes staging views + fact MERGE + mart rebuild.
- **Alerts**: Cloud Run Job exits non-zero if any extractor fails; set up a Cloud Logging alert on `severity>=ERROR` for the job name.
- **Data close**: Treat days older than **T−14** as final. Days T−0 … T−13 are provisional; do not publish MMM results that include them unfiltered.
- **Backfill**: `gcloud run jobs execute ssot-daily --region=$REGION --args=run,--as-of,YYYY-MM-DD` re-reads the window anchored at the given date.
- **Schema drift**: if a Supermetrics field disappears, the raw DDL will fail to load (ignore_unknown_values=true keeps loads alive, but the staging view will null). Update `config/sources.yaml` and the matching raw DDL.

## License

Internal — adjust per your org's default.
