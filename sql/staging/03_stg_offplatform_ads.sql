-- Silver: unify Meta CPAS + Google Ads (Shopee-landing) into a single off-platform stream.
-- Meta: filter rows to catalog_sales with a partner_catalog_id whitelist (maintained in seed_meta_catalogs).
-- Google: filter rows where final_url matches shopee.* OR campaign_name begins with SHP_.

CREATE OR REPLACE VIEW `${GCP_PROJECT}.${STG_DATASET}.stg_offplatform_ads` AS
WITH meta AS (
  SELECT
    'meta_cpas'                             AS platform,
    COALESCE(m._market, m.Country)          AS market,
    'shopee'                                AS destination_platform,  -- refine using catalog_id whitelist below
    m.Campaign_id                           AS campaign_id,
    m.Adset_id                              AS ad_set_or_ad_group_id,
    'catalog_sales'                         AS campaign_type,
    m.Catalog_id                            AS catalog_id,
    m.Currency                              AS currency,
    m.Spend                                 AS spend_local,
    m.Impressions                           AS impressions,
    m.Link_clicks                           AS clicks,
    m.Add_to_cart                           AS add_to_cart,
    m.Purchase                              AS purchases_reported,
    m.Purchase_value                        AS purchase_value_reported_local,
    m.Attribution_window                    AS attribution_window,
    DATE(m.Date)                            AS date_report,
    m.ingested_at                           AS ingested_at
  FROM `${GCP_PROJECT}.${RAW_DATASET}.meta_cpas_daily` m
  -- Keep only CPAS
  WHERE UPPER(m.Objective) LIKE '%CATALOG%'
    -- Whitelist-based filtering by catalog_id is the reliable CPAS signal — wire via seed table below
),
google AS (
  SELECT
    'google_ads_shopee'                     AS platform,
    COALESCE(g._market, g.Country)          AS market,
    'shopee'                                AS destination_platform,
    g.Campaign_id                           AS campaign_id,
    g.Ad_group_id                           AS ad_set_or_ad_group_id,
    g.Campaign_type                         AS campaign_type,
    CAST(NULL AS STRING)                    AS catalog_id,
    g.Currency                              AS currency,
    g.Spend                                 AS spend_local,
    g.Impressions                           AS impressions,
    g.Clicks                                AS clicks,
    CAST(NULL AS INT64)                     AS add_to_cart,
    CAST(g.Conversions AS INT64)            AS purchases_reported,
    g.Conversion_value                      AS purchase_value_reported_local,
    g.Attribution_model                     AS attribution_window,
    DATE(g.Date)                            AS date_report,
    g.ingested_at                           AS ingested_at
  FROM `${GCP_PROJECT}.${RAW_DATASET}.google_ads_shopee_daily` g
  WHERE REGEXP_CONTAINS(LOWER(COALESCE(g.Final_url,'')), r'^https?://([a-z]+\.)?shopee\.')
     OR UPPER(COALESCE(g.Campaign_name, '')) LIKE 'SHP[_-]%'
),
unioned AS (
  SELECT * FROM meta
  UNION ALL
  SELECT * FROM google
),
deduped AS (
  SELECT * FROM (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY platform, date_report, market, campaign_id,
                     COALESCE(ad_set_or_ad_group_id, '')
        ORDER BY ingested_at DESC
      ) AS rn
    FROM unioned
  )
  WHERE rn = 1
)
SELECT
  platform,
  market,
  destination_platform,
  campaign_id,
  ad_set_or_ad_group_id,
  campaign_type,
  catalog_id,
  currency,
  spend_local,
  SAFE_DIVIDE(spend_local, fx.usd_rate) AS spend_usd,
  impressions,
  clicks,
  add_to_cart,
  purchases_reported,
  purchase_value_reported_local,
  SAFE_DIVIDE(purchase_value_reported_local, fx.usd_rate) AS purchase_value_reported_usd,
  attribution_window,
  date_report AS date_local,
  ingested_at
FROM deduped d
LEFT JOIN `${GCP_PROJECT}.${SEED_DATASET}.dim_fx_rate` fx
  ON fx.date = d.date_report AND fx.currency = d.currency;
