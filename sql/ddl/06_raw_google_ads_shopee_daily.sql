CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${RAW_DATASET}.google_ads_shopee_daily` (
  Date                       DATE,
  Customer_id                STRING,
  Campaign_id                STRING,
  Campaign_name              STRING,
  Campaign_type              STRING, -- SEARCH, PMAX, SHOPPING, DEMAND_GEN, VIDEO
  Ad_group_id                STRING,
  Ad_group_name              STRING,
  Keyword                    STRING,
  Final_url                  STRING,
  Country                    STRING,
  Currency                   STRING,
  Cost_micros                INT64,
  Spend                      NUMERIC,  -- cost_micros / 1e6 at ingest
  Impressions                INT64,
  Clicks                     INT64,
  Conversions                FLOAT64,
  Conversion_value           NUMERIC,
  All_conversions            FLOAT64,
  Attribution_model          STRING,
  _source_system             STRING,
  _market                    STRING,
  _accounts                  STRING,
  _window_start              DATE,
  _window_end                DATE,
  ingested_at                TIMESTAMP
)
PARTITION BY DATE(ingested_at)
CLUSTER BY _market, Customer_id, Campaign_id;
