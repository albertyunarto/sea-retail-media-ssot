-- Silver: unify TikTok Ads + Shopee Ads into a single daily ads stream.
-- Voucher-funded spend is stripped for Shopee when the split is exposed.

CREATE OR REPLACE VIEW `${GCP_PROJECT}.${STG_DATASET}.stg_onplatform_ads` AS
WITH tiktok AS (
  SELECT
    'tiktok_ads'                                   AS platform,
    COALESCE(t._market, t.Country_code)            AS market,
    CASE
      WHEN LOWER(t.Objective_type) LIKE '%video%'     THEN 'video'
      WHEN LOWER(t.Objective_type) LIKE '%live%'      THEN 'live'
      WHEN LOWER(t.Objective_type) LIKE '%catalog%'   THEN 'catalog'
      WHEN LOWER(t.Objective_type) LIKE '%search%'    THEN 'search'
      ELSE 'other'
    END                                             AS ad_type,
    t.Objective_type                                AS objective,
    t.Campaign_id                                   AS campaign_id,
    t.Ad_group_id                                   AS ad_group_id,
    CAST(NULL AS STRING)                            AS sku_id,
    t.Currency                                      AS currency,
    CAST(t.Spend AS NUMERIC)                        AS spend_local,
    t.Impressions                                   AS impressions,
    t.Clicks                                        AS clicks,
    t.Video_play_6s                                 AS video_views_2s_or_6s,
    t.Complete_payment                              AS direct_orders,
    CAST(NULL AS INT64)                             AS broad_orders,
    CAST(t.Complete_payment_value AS NUMERIC)       AS direct_gmv_local,
    CAST(NULL AS NUMERIC)                           AS broad_gmv_local,
    t.Conversion_attribution_window                 AS attribution_window,
    DATE(t.Date)                                    AS date_report,
    t.ingested_at                                   AS ingested_at
  FROM `${GCP_PROJECT}.${RAW_DATASET}.tiktok_ads_daily` t
),
shopee AS (
  SELECT
    'shopee_ads'                                   AS platform,
    COALESCE(s._market, s.Country)                 AS market,
    LOWER(s.Ad_type)                               AS ad_type,
    NULL                                           AS objective,
    s.Campaign_id                                  AS campaign_id,
    CAST(NULL AS STRING)                           AS ad_group_id,
    s.Sku_id                                       AS sku_id,
    s.Currency                                     AS currency,
    GREATEST(COALESCE(s.Spend, 0) - COALESCE(s.Voucher_subsidy, 0), 0) AS spend_local,
    s.Impressions                                  AS impressions,
    s.Clicks                                       AS clicks,
    CAST(NULL AS INT64)                            AS video_views_2s_or_6s,
    s.Direct_orders                                AS direct_orders,
    s.Broad_orders                                 AS broad_orders,
    s.Direct_gmv                                   AS direct_gmv_local,
    s.Broad_gmv                                    AS broad_gmv_local,
    s.Attribution_window                           AS attribution_window,
    DATE(s.Date)                                   AS date_report,
    s.ingested_at                                  AS ingested_at
  FROM `${GCP_PROJECT}.${RAW_DATASET}.shopee_ads_daily` s
),
unioned AS (
  SELECT * FROM tiktok
  UNION ALL
  SELECT * FROM shopee
),
deduped AS (
  SELECT * FROM (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY platform, date_report, market, campaign_id,
                     COALESCE(ad_group_id, ''), COALESCE(sku_id, ''), ad_type
        ORDER BY ingested_at DESC
      ) AS rn
    FROM unioned
  )
  WHERE rn = 1
)
SELECT
  platform,
  market,
  ad_type,
  objective,
  campaign_id,
  ad_group_id,
  sku_id,
  currency,
  spend_local,
  -- USD via dim_fx_rate; fallback to 0 if missing rate to keep pipeline non-blocking
  SAFE_DIVIDE(spend_local, fx.usd_rate) AS spend_usd,
  impressions,
  clicks,
  video_views_2s_or_6s,
  direct_orders,
  broad_orders,
  direct_gmv_local,
  broad_gmv_local,
  SAFE_DIVIDE(direct_gmv_local, fx.usd_rate) AS direct_gmv_usd,
  SAFE_DIVIDE(broad_gmv_local,  fx.usd_rate) AS broad_gmv_usd,
  attribution_window,
  date_report AS date_local,  -- Supermetrics report date is already market-local for these connectors
  ingested_at
FROM deduped d
LEFT JOIN `${GCP_PROJECT}.${SEED_DATASET}.dim_fx_rate` fx
  ON fx.date = d.date_report AND fx.currency = d.currency;
