-- Raw TikTok Shop orders from Supermetrics.
-- Field names match what Supermetrics returns; may drift — verify against your query in sources.yaml.
-- Partitioned on the local posting date we derive at staging time; here we partition on ingested_at day
-- so late-arriving data is easy to isolate.

CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${RAW_DATASET}.tiktok_shop_orders` (
  Date                    DATE,
  Order_id                STRING,
  Order_status            STRING,
  Order_create_time       TIMESTAMP,
  Payment_time            TIMESTAMP,
  Buyer_country           STRING,
  Shop_id                 STRING,
  Sku_id                  STRING,
  Product_id              STRING,
  Quantity                INT64,
  Original_price          NUMERIC,
  Sub_total               NUMERIC,
  Order_amount            NUMERIC,
  Currency                STRING,
  Shipping_fee            NUMERIC,
  Order_source            STRING,
  Affiliate_creator_id    STRING,
  _source_system          STRING,
  _market                 STRING,
  _accounts               STRING,
  _window_start           DATE,
  _window_end             DATE,
  ingested_at             TIMESTAMP
)
PARTITION BY DATE(ingested_at)
CLUSTER BY _market, Shop_id, Sku_id;
