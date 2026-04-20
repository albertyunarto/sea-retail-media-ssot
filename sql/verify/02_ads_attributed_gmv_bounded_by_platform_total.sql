-- Invariant: per (date, market, anchor_platform),
--   SUM(ads_attributed_gmv_usd) <= 1.05 * platform_total_gmv_usd.
-- Returns ZERO rows on pass.
WITH panel AS (
  SELECT
    date_local, market, platform,
    SUM(ads_attributed_gmv_usd) AS ads_gmv,
    ANY_VALUE(platform_total_gmv_usd) AS plat_gmv
  FROM `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel`
  WHERE platform_total_gmv_usd IS NOT NULL
  GROUP BY 1,2,3
)
SELECT *
FROM panel
WHERE ads_gmv > 1.05 * plat_gmv;
