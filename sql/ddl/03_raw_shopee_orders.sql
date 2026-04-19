CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${RAW_DATASET}.shopee_orders` (
  Date                     DATE,
  Order_sn                 STRING,
  Order_status             STRING,
  Create_time              TIMESTAMP,
  Pay_time                 TIMESTAMP,
  Complete_time            TIMESTAMP,
  Buyer_id_hash            STRING,
  Shop_id                  STRING,
  Country                  STRING,
  Sku                      STRING,
  Item_id                  STRING,
  Quantity                 INT64,
  Merchandise_subtotal     NUMERIC,
  Escrow_amount            NUMERIC,
  Currency                 STRING,
  Logistics_status         STRING,
  Voucher_platform         NUMERIC,
  Voucher_seller           NUMERIC,
  Traffic_source           STRING,
  _source_system           STRING,
  _market                  STRING,
  _accounts                STRING,
  _window_start            DATE,
  _window_end              DATE,
  ingested_at              TIMESTAMP
)
PARTITION BY DATE(ingested_at)
CLUSTER BY _market, Shop_id, Sku;
