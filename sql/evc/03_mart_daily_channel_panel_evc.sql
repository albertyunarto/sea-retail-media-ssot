-- daily_channel_panel_evc — daily_channel_panel + EVC columns, pivoted.
-- Grain matches daily_channel_panel (date_local × market × channel) with
-- additional columns:
--   - reported_conversions        (click-through / direct orders only)
--   - evc_conversions             (view-assisted / engaged-view incremental)
--   - all_conversions             (reported + EVC; what Meta/Google/TikTok UI shows)
--   - reported_gmv_usd            (as in existing daily_channel_panel)
--   - evc_gmv_usd                 (incremental value attributable to EVC)
--   - all_gmv_usd                 (reported + EVC GMV)
--
-- Dashboard (PRD-B) uses this with a toggle to show reported-only vs all.
-- Invariant: evc_conversions <= all_conversions per row (checked in verify/).

CREATE OR REPLACE TABLE `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel_evc`
PARTITION BY date_local
CLUSTER BY market, channel AS
WITH evc AS (
  SELECT
    date_local,
    market,
    channel,
    SUM(IF(attribution_bucket = 'click', conversions, 0))          AS reported_conversions,
    SUM(IF(attribution_bucket = 'evc',   conversions, 0))          AS evc_conversions,
    SUM(IF(attribution_bucket = 'click', conversion_value_usd, 0)) AS reported_value_usd,
    SUM(IF(attribution_bucket = 'evc',   conversion_value_usd, 0)) AS evc_value_usd
  FROM `${GCP_PROJECT}.${FACT_DATASET}.fact_evc`
  GROUP BY 1,2,3
)
SELECT
  p.date_local,
  p.market,
  p.channel,
  p.platform,
  p.spend_usd,
  p.impressions,
  p.clicks,
  p.ads_attributed_orders,
  p.ads_attributed_gmv_usd                              AS reported_gmv_usd,
  p.direct_gmv_usd,
  p.broad_gmv_usd,
  COALESCE(e.evc_value_usd, 0)                          AS evc_gmv_usd,
  p.ads_attributed_gmv_usd + COALESCE(e.evc_value_usd, 0) AS all_gmv_usd,
  COALESCE(e.reported_conversions, p.ads_attributed_orders) AS reported_conversions,
  COALESCE(e.evc_conversions, 0)                        AS evc_conversions,
  COALESCE(e.reported_conversions, p.ads_attributed_orders)
    + COALESCE(e.evc_conversions, 0)                    AS all_conversions,
  p.platform_total_orders,
  p.platform_total_gmv_usd,
  p.is_weekend,
  p.is_payday,
  p.is_mega_sale,
  p.week_of_year,
  CURRENT_TIMESTAMP() AS loaded_at
FROM `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel` p
LEFT JOIN evc e
  ON e.date_local = p.date_local
 AND e.market     = p.market
 AND e.channel    = p.channel;
