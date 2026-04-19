-- Silver: unify Shopee + TikTok Shop orders into a single order-line stream
-- with local timezone bucketing, canonical traffic_source, and dedup on natural key.

CREATE OR REPLACE VIEW `${GCP_PROJECT}.${STG_DATASET}.stg_platform_sales` AS
WITH shopee_base AS (
  SELECT
    'shopee'                                      AS platform,
    COALESCE(so._market, so.Country)              AS market,
    so.Shop_id                                    AS shop_id,
    so.Sku                                        AS sku_id,
    so.Item_id                                    AS item_id,
    so.Order_sn                                   AS order_id,
    LOWER(so.Order_status)                        AS order_status,
    so.Create_time                                AS create_time_utc,
    so.Pay_time                                   AS pay_time_utc,
    so.Complete_time                              AS complete_time_utc,
    so.Quantity                                   AS quantity,
    so.Merchandise_subtotal                       AS gmv_local,
    so.Currency                                   AS currency,
    COALESCE(st.canonical, LOWER(so.Traffic_source)) AS traffic_source,
    so.ingested_at                                AS ingested_at
  FROM `${GCP_PROJECT}.${RAW_DATASET}.shopee_orders` so
  LEFT JOIN `${GCP_PROJECT}.${SEED_DATASET}.seed_traffic_source` st
    ON st.platform = 'shopee' AND st.raw_value = LOWER(so.Traffic_source)
),
tts_base AS (
  SELECT
    'tiktok_shop'                                 AS platform,
    COALESCE(t._market, t.Buyer_country)          AS market,
    t.Shop_id                                     AS shop_id,
    t.Sku_id                                      AS sku_id,
    t.Product_id                                  AS item_id,
    t.Order_id                                    AS order_id,
    LOWER(t.Order_status)                         AS order_status,
    t.Order_create_time                           AS create_time_utc,
    t.Payment_time                                AS pay_time_utc,
    CAST(NULL AS TIMESTAMP)                       AS complete_time_utc,
    t.Quantity                                    AS quantity,
    t.Order_amount                                AS gmv_local,
    t.Currency                                    AS currency,
    COALESCE(st.canonical, LOWER(t.Order_source)) AS traffic_source,
    t.ingested_at                                 AS ingested_at
  FROM `${GCP_PROJECT}.${RAW_DATASET}.tiktok_shop_orders` t
  LEFT JOIN `${GCP_PROJECT}.${SEED_DATASET}.seed_traffic_source` st
    ON st.platform = 'tiktok_shop' AND st.raw_value = t.Order_source
),
unioned AS (
  SELECT * FROM shopee_base
  UNION ALL
  SELECT * FROM tts_base
),
deduped AS (
  SELECT *
  FROM (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY platform, order_id, sku_id
        ORDER BY ingested_at DESC
      ) AS rn
    FROM unioned
  )
  WHERE rn = 1
)
SELECT
  platform,
  market,
  shop_id,
  sku_id,
  item_id,
  order_id,
  order_status,
  -- Local-date bucketing. TS from raw is UTC; shift to market tz via dim_market.
  DATE(
    TIMESTAMP(create_time_utc),
    dm.timezone
  ) AS date_local,
  create_time_utc,
  pay_time_utc,
  complete_time_utc,
  quantity,
  gmv_local,
  currency,
  traffic_source,
  -- Terminal-status flags used in fact for net GMV
  order_status IN ('cancelled','canceled','returned','failed','refunded') AS is_cancelled,
  order_status IN ('completed','delivered','shipped')                      AS is_completed,
  ingested_at
FROM deduped d
LEFT JOIN `${GCP_PROJECT}.${SEED_DATASET}.dim_market` dm USING (market);
