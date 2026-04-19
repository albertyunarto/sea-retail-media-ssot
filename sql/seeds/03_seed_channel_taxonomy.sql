CREATE OR REPLACE TABLE `${GCP_PROJECT}.${SEED_DATASET}.seed_channel_taxonomy` AS
SELECT * FROM UNNEST([
  STRUCT('shopee_organic'              AS channel, 'shopee'      AS platform),
  STRUCT('shopee_ads_product_search'   AS channel, 'shopee'      AS platform),
  STRUCT('shopee_ads_shop_search'      AS channel, 'shopee'      AS platform),
  STRUCT('shopee_ads_targeting'        AS channel, 'shopee'      AS platform),
  STRUCT('shopee_ads_gmv_max'          AS channel, 'shopee'      AS platform),
  STRUCT('tiktok_shop_organic'         AS channel, 'tiktok_shop' AS platform),
  STRUCT('tiktok_shop_live'            AS channel, 'tiktok_shop' AS platform),
  STRUCT('tiktok_shop_video'           AS channel, 'tiktok_shop' AS platform),
  STRUCT('tiktok_ads'                  AS channel, 'tiktok_shop' AS platform),
  STRUCT('meta_cpas'                   AS channel, 'shopee'      AS platform),  -- destination-dependent; see staging
  STRUCT('google_ads_shopee'           AS channel, 'shopee'      AS platform)
]);
