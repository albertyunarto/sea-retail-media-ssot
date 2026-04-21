-- Invariant: per row in the mart, direct_gmv_usd <= broad_gmv_usd.
-- Broad = direct + view-assisted on Shopee, or = direct duplicated on
-- non-Shopee channels per the measurement-framework charter. NULL on
-- organic rows (they pass vacuously).
-- Returns ZERO rows on pass.
SELECT
  date_local,
  market,
  channel,
  direct_gmv_usd,
  broad_gmv_usd
FROM `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel`
WHERE direct_gmv_usd IS NOT NULL
  AND broad_gmv_usd  IS NOT NULL
  AND direct_gmv_usd > broad_gmv_usd + 1e-6;
