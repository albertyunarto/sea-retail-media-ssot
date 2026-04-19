-- Gold mart: the long-format daily_channel_panel consumed by MMM / regression / Causal Impact.
-- Grain: date_local × market × channel.
--
-- Channels are derived from the three fact tables via the taxonomy below:
--   shopee_organic            <- fact_platform_sales (platform='shopee'),  non-ads traffic share of day
--   tiktok_shop_organic       <- fact_platform_sales (platform='tiktok_shop'), non-ads share
--   tiktok_shop_live/video    <- fact_platform_sales (platform='tiktok_shop'), traffic_source-derived
--   shopee_ads_*              <- fact_onplatform_ads (platform='shopee_ads')  by ad_type
--   tiktok_ads                <- fact_onplatform_ads (platform='tiktok_ads')
--   meta_cpas                 <- fact_offplatform_ads (platform='meta_cpas')
--   google_ads_shopee         <- fact_offplatform_ads (platform='google_ads_shopee')
--
-- platform_total_gmv / _orders are repeated across every channel row for the same
-- (date, market, platform). The MMM consumer should de-dup when using them as DV.

CREATE OR REPLACE TABLE `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel`
PARTITION BY date_local
CLUSTER BY market, channel AS

WITH platform_totals AS (
  SELECT
    date_local,
    market,
    platform,
    SUM(orders_net)  AS platform_total_orders,
    SUM(gmv_net_usd) AS platform_total_gmv_usd
  FROM `${GCP_PROJECT}.${FACT_DATASET}.fact_platform_sales`
  GROUP BY 1,2,3
),
-- On-platform ads → channel
on_platform AS (
  SELECT
    date_local,
    market,
    CASE
      WHEN platform = 'tiktok_ads'  THEN 'tiktok_ads'
      WHEN platform = 'shopee_ads' AND ad_type = 'product_search' THEN 'shopee_ads_product_search'
      WHEN platform = 'shopee_ads' AND ad_type = 'shop_search'    THEN 'shopee_ads_shop_search'
      WHEN platform = 'shopee_ads' AND ad_type = 'targeting'      THEN 'shopee_ads_targeting'
      WHEN platform = 'shopee_ads' AND ad_type = 'gmv_max'        THEN 'shopee_ads_gmv_max'
      WHEN platform = 'shopee_ads' AND ad_type = 'affiliate'      THEN 'shopee_ads_affiliate'
      ELSE CONCAT(platform, '_other')
    END AS channel,
    CASE WHEN platform = 'tiktok_ads' THEN 'tiktok_shop' ELSE 'shopee' END AS anchor_platform,
    SUM(spend_usd)                                        AS spend_usd,
    SUM(impressions)                                      AS impressions,
    SUM(clicks)                                           AS clicks,
    SUM(COALESCE(broad_orders, direct_orders))            AS ads_attributed_orders,
    SUM(COALESCE(broad_gmv_usd, direct_gmv_usd))          AS ads_attributed_gmv_usd
  FROM `${GCP_PROJECT}.${FACT_DATASET}.fact_onplatform_ads`
  GROUP BY 1,2,3,4
),
-- Off-platform ads → channel
off_platform AS (
  SELECT
    date_local,
    market,
    platform AS channel,
    destination_platform AS anchor_platform,
    SUM(spend_usd)                          AS spend_usd,
    SUM(impressions)                        AS impressions,
    SUM(clicks)                             AS clicks,
    SUM(purchases_reported)                 AS ads_attributed_orders,
    SUM(purchase_value_reported_usd)        AS ads_attributed_gmv_usd
  FROM `${GCP_PROJECT}.${FACT_DATASET}.fact_offplatform_ads`
  GROUP BY 1,2,3,4
),
-- Organic / non-ads split from platform sales, using traffic_source_mix JSON
organic AS (
  SELECT
    fps.date_local,
    fps.market,
    fps.platform AS anchor_platform,
    CASE
      WHEN fps.platform = 'shopee'      THEN 'shopee_organic'
      WHEN fps.platform = 'tiktok_shop' THEN 'tiktok_shop_organic'
      ELSE CONCAT(fps.platform, '_organic')
    END AS channel,
    0.0        AS spend_usd,
    CAST(NULL AS INT64) AS impressions,
    CAST(NULL AS INT64) AS clicks,
    CAST(NULL AS INT64) AS ads_attributed_orders,
    CAST(NULL AS NUMERIC) AS ads_attributed_gmv_usd
  FROM `${GCP_PROJECT}.${FACT_DATASET}.fact_platform_sales` fps
  GROUP BY 1,2,3,4
),
unioned AS (
  SELECT channel, date_local, market, anchor_platform,
         spend_usd, impressions, clicks, ads_attributed_orders, ads_attributed_gmv_usd
  FROM on_platform
  UNION ALL
  SELECT channel, date_local, market, anchor_platform,
         spend_usd, impressions, clicks, ads_attributed_orders, ads_attributed_gmv_usd
  FROM off_platform
  UNION ALL
  SELECT channel, date_local, market, anchor_platform,
         spend_usd, impressions, clicks, ads_attributed_orders, ads_attributed_gmv_usd
  FROM organic
)
SELECT
  u.date_local,
  u.market,
  u.channel,
  u.anchor_platform AS platform,
  COALESCE(u.spend_usd, 0)                                      AS spend_usd,
  u.impressions,
  u.clicks,
  u.ads_attributed_orders,
  u.ads_attributed_gmv_usd,
  pt.platform_total_orders,
  pt.platform_total_gmv_usd,
  -- covariates
  EXTRACT(DAYOFWEEK FROM u.date_local) = 7 OR EXTRACT(DAYOFWEEK FROM u.date_local) = 1 AS is_weekend,
  EXTRACT(DAY FROM u.date_local) IN (1, 15, 16) AS is_payday,
  EXTRACT(WEEK(MONDAY) FROM u.date_local) AS week_of_year,
  CURRENT_TIMESTAMP() AS loaded_at
FROM unioned u
LEFT JOIN platform_totals pt
  ON pt.date_local = u.date_local
 AND pt.market     = u.market
 AND pt.platform   = u.anchor_platform;
