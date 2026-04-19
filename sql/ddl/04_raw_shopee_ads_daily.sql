CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${RAW_DATASET}.shopee_ads_daily` (
  Date                        DATE,
  Shop_id                     STRING,
  Country                     STRING,
  Currency                    STRING,
  Ad_type                     STRING,   -- product_search, shop_search, targeting, gmv_max, affiliate
  Campaign_id                 STRING,
  Campaign_name               STRING,
  Sku_id                      STRING,
  Keyword                     STRING,
  Match_type                  STRING,
  Spend                       NUMERIC,  -- raw; may include platform subsidy depending on account
  Voucher_subsidy             NUMERIC,  -- advertiser-external subsidy when exposed
  Impressions                 INT64,
  Clicks                      INT64,
  Direct_orders               INT64,
  Broad_orders                INT64,
  Direct_gmv                  NUMERIC,
  Broad_gmv                   NUMERIC,
  Attribution_window          STRING,
  _source_system              STRING,
  _market                     STRING,
  _accounts                   STRING,
  _window_start               DATE,
  _window_end                 DATE,
  ingested_at                 TIMESTAMP
)
PARTITION BY DATE(ingested_at)
CLUSTER BY _market, Shop_id, Ad_type;
