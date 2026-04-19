CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${FACT_DATASET}.fact_offplatform_ads` (
  date_local                      DATE,
  market                          STRING,
  platform                        STRING,
  destination_platform            STRING,
  campaign_id                     STRING,
  ad_set_or_ad_group_id           STRING,
  campaign_type                   STRING,
  catalog_id                      STRING,
  spend_local                     NUMERIC,
  spend_usd                       NUMERIC,
  impressions                     INT64,
  clicks                          INT64,
  add_to_cart                     INT64,
  purchases_reported              INT64,
  purchase_value_reported_local   NUMERIC,
  purchase_value_reported_usd     NUMERIC,
  attribution_window              STRING,
  currency                        STRING,
  loaded_at                       TIMESTAMP
)
PARTITION BY date_local
CLUSTER BY market, platform, campaign_id;

MERGE `${GCP_PROJECT}.${FACT_DATASET}.fact_offplatform_ads` T
USING (
  SELECT
    date_local, market, platform, destination_platform,
    campaign_id, ad_set_or_ad_group_id, campaign_type, catalog_id,
    SUM(spend_local)                            AS spend_local,
    SUM(spend_usd)                              AS spend_usd,
    SUM(impressions)                            AS impressions,
    SUM(clicks)                                 AS clicks,
    SUM(add_to_cart)                            AS add_to_cart,
    SUM(purchases_reported)                     AS purchases_reported,
    SUM(purchase_value_reported_local)          AS purchase_value_reported_local,
    SUM(purchase_value_reported_usd)            AS purchase_value_reported_usd,
    ANY_VALUE(attribution_window)               AS attribution_window,
    ANY_VALUE(currency)                         AS currency
  FROM `${GCP_PROJECT}.${STG_DATASET}.stg_offplatform_ads`
  WHERE date_local >= DATE_SUB(CURRENT_DATE(), INTERVAL 21 DAY)
  GROUP BY date_local, market, platform, destination_platform,
           campaign_id, ad_set_or_ad_group_id, campaign_type, catalog_id
) S
ON  T.date_local  = S.date_local
AND T.market      = S.market
AND T.platform    = S.platform
AND T.campaign_id = S.campaign_id
AND COALESCE(T.ad_set_or_ad_group_id,'') = COALESCE(S.ad_set_or_ad_group_id,'')
WHEN MATCHED THEN UPDATE SET
  destination_platform          = S.destination_platform,
  campaign_type                 = S.campaign_type,
  catalog_id                    = S.catalog_id,
  spend_local                   = S.spend_local,
  spend_usd                     = S.spend_usd,
  impressions                   = S.impressions,
  clicks                        = S.clicks,
  add_to_cart                   = S.add_to_cart,
  purchases_reported            = S.purchases_reported,
  purchase_value_reported_local = S.purchase_value_reported_local,
  purchase_value_reported_usd   = S.purchase_value_reported_usd,
  attribution_window            = S.attribution_window,
  currency                      = S.currency,
  loaded_at                     = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (
  date_local, market, platform, destination_platform,
  campaign_id, ad_set_or_ad_group_id, campaign_type, catalog_id,
  spend_local, spend_usd, impressions, clicks, add_to_cart,
  purchases_reported, purchase_value_reported_local, purchase_value_reported_usd,
  attribution_window, currency, loaded_at
) VALUES (
  S.date_local, S.market, S.platform, S.destination_platform,
  S.campaign_id, S.ad_set_or_ad_group_id, S.campaign_type, S.catalog_id,
  S.spend_local, S.spend_usd, S.impressions, S.clicks, S.add_to_cart,
  S.purchases_reported, S.purchase_value_reported_local, S.purchase_value_reported_usd,
  S.attribution_window, S.currency, CURRENT_TIMESTAMP()
);
