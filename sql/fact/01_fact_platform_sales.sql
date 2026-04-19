-- Gold: daily × market × platform × shop × sku aggregate with net-GMV logic.
-- Full-refresh MERGE on the rolling window present in stg (currently last 14 days).

CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${FACT_DATASET}.fact_platform_sales` (
  date_local          DATE,
  market              STRING,
  platform            STRING,
  shop_id             STRING,
  sku_id              STRING,
  orders_gross        INT64,
  orders_cancelled    INT64,
  orders_net          INT64,
  gmv_gross_local     NUMERIC,
  gmv_net_local       NUMERIC,
  gmv_net_usd         NUMERIC,
  currency            STRING,
  traffic_source_mix  JSON,     -- e.g. {"organic":0.6,"live":0.3,...}
  loaded_at           TIMESTAMP
)
PARTITION BY date_local
CLUSTER BY market, platform, sku_id;

MERGE `${GCP_PROJECT}.${FACT_DATASET}.fact_platform_sales` T
USING (
  WITH base AS (
    SELECT
      s.date_local,
      s.market,
      s.platform,
      s.shop_id,
      s.sku_id,
      s.currency,
      s.traffic_source,
      s.is_cancelled,
      s.is_completed,
      s.gmv_local
    FROM `${GCP_PROJECT}.${STG_DATASET}.stg_platform_sales` s
    WHERE s.date_local >= DATE_SUB(CURRENT_DATE(), INTERVAL 21 DAY)
  ),
  agg AS (
    SELECT
      date_local, market, platform, shop_id, sku_id,
      ANY_VALUE(currency) AS currency,
      COUNT(*)                                                     AS orders_gross,
      COUNTIF(is_cancelled)                                        AS orders_cancelled,
      COUNT(*) - COUNTIF(is_cancelled)                             AS orders_net,
      SUM(gmv_local)                                               AS gmv_gross_local,
      SUM(IF(is_cancelled, 0, gmv_local))                          AS gmv_net_local
    FROM base
    GROUP BY 1,2,3,4,5
  ),
  mix AS (
    SELECT
      date_local, market, platform, shop_id, sku_id,
      TO_JSON(
        ARRAY_AGG(STRUCT(traffic_source, cnt))
      ) AS traffic_source_mix
    FROM (
      SELECT date_local, market, platform, shop_id, sku_id, traffic_source, COUNT(*) AS cnt
      FROM base
      GROUP BY 1,2,3,4,5,6
    )
    GROUP BY 1,2,3,4,5
  )
  SELECT
    a.*,
    SAFE_DIVIDE(a.gmv_net_local, fx.usd_rate) AS gmv_net_usd,
    mix.traffic_source_mix
  FROM agg a
  LEFT JOIN mix USING (date_local, market, platform, shop_id, sku_id)
  LEFT JOIN `${GCP_PROJECT}.${SEED_DATASET}.dim_fx_rate` fx
    ON fx.date = a.date_local AND fx.currency = a.currency
) S
ON  T.date_local = S.date_local
AND T.market     = S.market
AND T.platform   = S.platform
AND T.shop_id    = S.shop_id
AND T.sku_id     = S.sku_id
WHEN MATCHED THEN UPDATE SET
  orders_gross       = S.orders_gross,
  orders_cancelled   = S.orders_cancelled,
  orders_net         = S.orders_net,
  gmv_gross_local    = S.gmv_gross_local,
  gmv_net_local      = S.gmv_net_local,
  gmv_net_usd        = S.gmv_net_usd,
  currency           = S.currency,
  traffic_source_mix = S.traffic_source_mix,
  loaded_at          = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (
  date_local, market, platform, shop_id, sku_id,
  orders_gross, orders_cancelled, orders_net,
  gmv_gross_local, gmv_net_local, gmv_net_usd,
  currency, traffic_source_mix, loaded_at
) VALUES (
  S.date_local, S.market, S.platform, S.shop_id, S.sku_id,
  S.orders_gross, S.orders_cancelled, S.orders_net,
  S.gmv_gross_local, S.gmv_net_local, S.gmv_net_usd,
  S.currency, S.traffic_source_mix, CURRENT_TIMESTAMP()
);
