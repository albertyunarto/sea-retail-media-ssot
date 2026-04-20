-- fact_evc — daily × market × channel × attribution_bucket rollup in USD.
-- MERGE pattern mirrors fact_platform_sales / fact_onplatform_ads: full refresh
-- of the trailing 21-day window to absorb late data.

CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${FACT_DATASET}.fact_evc` (
  date_local              DATE,
  market                  STRING,
  channel                 STRING,
  attribution_bucket      STRING,        -- 'click' | 'evc'
  conversions             FLOAT64,
  conversion_value_local  NUMERIC,
  conversion_value_usd    NUMERIC,
  currency                STRING,
  loaded_at               TIMESTAMP
)
PARTITION BY date_local
CLUSTER BY market, channel;

MERGE `${GCP_PROJECT}.${FACT_DATASET}.fact_evc` T
USING (
  WITH src AS (
    SELECT
      s.date_local,
      s.market,
      s.channel,
      s.attribution_bucket,
      s.conversions,
      s.conversion_value_local,
      dm.currency,
      fx.usd_rate
    FROM `${GCP_PROJECT}.${STG_DATASET}.stg_evc` s
    LEFT JOIN `${GCP_PROJECT}.${SEED_DATASET}.dim_market`   dm ON dm.market   = s.market
    LEFT JOIN `${GCP_PROJECT}.${SEED_DATASET}.dim_fx_rate`  fx ON fx.date     = s.date_local
                                                              AND fx.currency = dm.currency
    WHERE s.date_local >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)
  )
  SELECT
    date_local,
    market,
    channel,
    attribution_bucket,
    SUM(conversions)                                    AS conversions,
    SUM(conversion_value_local)                         AS conversion_value_local,
    SAFE_DIVIDE(SUM(conversion_value_local), ANY_VALUE(usd_rate)) AS conversion_value_usd,
    ANY_VALUE(currency)                                 AS currency,
    CURRENT_TIMESTAMP()                                 AS loaded_at
  FROM src
  GROUP BY 1,2,3,4
) S
ON  T.date_local         = S.date_local
AND T.market             = S.market
AND T.channel            = S.channel
AND T.attribution_bucket = S.attribution_bucket
WHEN MATCHED THEN UPDATE SET
  conversions            = S.conversions,
  conversion_value_local = S.conversion_value_local,
  conversion_value_usd   = S.conversion_value_usd,
  currency               = S.currency,
  loaded_at              = S.loaded_at
WHEN NOT MATCHED THEN INSERT ROW;
