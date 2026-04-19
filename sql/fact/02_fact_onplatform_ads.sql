CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${FACT_DATASET}.fact_onplatform_ads` (
  date_local               DATE,
  market                   STRING,
  platform                 STRING,
  ad_type                  STRING,
  objective                STRING,
  campaign_id              STRING,
  ad_group_id              STRING,
  sku_id                   STRING,
  spend_local              NUMERIC,
  spend_usd                NUMERIC,
  impressions              INT64,
  clicks                   INT64,
  video_views_2s_or_6s     INT64,
  direct_orders            INT64,
  broad_orders             INT64,
  direct_gmv_local         NUMERIC,
  broad_gmv_local          NUMERIC,
  direct_gmv_usd           NUMERIC,
  broad_gmv_usd            NUMERIC,
  attribution_window       STRING,
  currency                 STRING,
  loaded_at                TIMESTAMP
)
PARTITION BY date_local
CLUSTER BY market, platform, campaign_id;

MERGE `${GCP_PROJECT}.${FACT_DATASET}.fact_onplatform_ads` T
USING (
  SELECT
    date_local, market, platform, ad_type, objective,
    campaign_id,
    ad_group_id,
    sku_id,
    SUM(spend_local)                AS spend_local,
    SUM(spend_usd)                  AS spend_usd,
    SUM(impressions)                AS impressions,
    SUM(clicks)                     AS clicks,
    SUM(video_views_2s_or_6s)       AS video_views_2s_or_6s,
    SUM(direct_orders)              AS direct_orders,
    SUM(broad_orders)               AS broad_orders,
    SUM(direct_gmv_local)           AS direct_gmv_local,
    SUM(broad_gmv_local)            AS broad_gmv_local,
    SUM(direct_gmv_usd)             AS direct_gmv_usd,
    SUM(broad_gmv_usd)              AS broad_gmv_usd,
    ANY_VALUE(attribution_window)   AS attribution_window,
    ANY_VALUE(currency)             AS currency
  FROM `${GCP_PROJECT}.${STG_DATASET}.stg_onplatform_ads`
  WHERE date_local >= DATE_SUB(CURRENT_DATE(), INTERVAL 21 DAY)
  GROUP BY date_local, market, platform, ad_type, objective,
           campaign_id, ad_group_id, sku_id
) S
ON  T.date_local   = S.date_local
AND T.market       = S.market
AND T.platform     = S.platform
AND T.ad_type      = S.ad_type
AND T.campaign_id  = S.campaign_id
AND COALESCE(T.ad_group_id,'') = COALESCE(S.ad_group_id,'')
AND COALESCE(T.sku_id,'')      = COALESCE(S.sku_id,'')
WHEN MATCHED THEN UPDATE SET
  objective            = S.objective,
  spend_local          = S.spend_local,
  spend_usd            = S.spend_usd,
  impressions          = S.impressions,
  clicks               = S.clicks,
  video_views_2s_or_6s = S.video_views_2s_or_6s,
  direct_orders        = S.direct_orders,
  broad_orders         = S.broad_orders,
  direct_gmv_local     = S.direct_gmv_local,
  broad_gmv_local      = S.broad_gmv_local,
  direct_gmv_usd       = S.direct_gmv_usd,
  broad_gmv_usd        = S.broad_gmv_usd,
  attribution_window   = S.attribution_window,
  currency             = S.currency,
  loaded_at            = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (
  date_local, market, platform, ad_type, objective,
  campaign_id, ad_group_id, sku_id,
  spend_local, spend_usd, impressions, clicks, video_views_2s_or_6s,
  direct_orders, broad_orders,
  direct_gmv_local, broad_gmv_local, direct_gmv_usd, broad_gmv_usd,
  attribution_window, currency, loaded_at
) VALUES (
  S.date_local, S.market, S.platform, S.ad_type, S.objective,
  S.campaign_id, S.ad_group_id, S.sku_id,
  S.spend_local, S.spend_usd, S.impressions, S.clicks, S.video_views_2s_or_6s,
  S.direct_orders, S.broad_orders,
  S.direct_gmv_local, S.broad_gmv_local, S.direct_gmv_usd, S.broad_gmv_usd,
  S.attribution_window, S.currency, CURRENT_TIMESTAMP()
);
