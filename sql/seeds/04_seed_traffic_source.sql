-- Platform traffic_source strings normalized to canonical values used downstream.
CREATE OR REPLACE TABLE `${GCP_PROJECT}.${SEED_DATASET}.seed_traffic_source` AS
SELECT * FROM UNNEST([
  -- Shopee
  STRUCT('shopee'      AS platform, 'organic'        AS raw_value, 'organic'       AS canonical),
  STRUCT('shopee',     'search',                                  'search'),
  STRUCT('shopee',     'feed',                                    'organic'),
  STRUCT('shopee',     'recommendation',                          'organic'),
  STRUCT('shopee',     'ads',                                     'ads'),
  STRUCT('shopee',     'affiliate',                               'affiliate'),
  -- TikTok Shop
  STRUCT('tiktok_shop','LIVE',                                    'live'),
  STRUCT('tiktok_shop','VIDEO',                                   'video'),
  STRUCT('tiktok_shop','PRODUCT_CARD',                            'product_card'),
  STRUCT('tiktok_shop','SEARCH',                                  'search'),
  STRUCT('tiktok_shop','MALL',                                    'organic'),
  STRUCT('tiktok_shop','AFFILIATE',                               'affiliate')
]);
