-- Placeholder daily FX table. Replace the UNNEST with a scheduled load from
-- your FX provider (OpenExchangeRates, ECB, Google Finance via BQ public). The
-- downstream contract is: one row per (date, currency) mapping to usd_rate.
--
-- The sample below plants a static indicative row for 2026-04-01; real use
-- requires daily backfill. Wire your provider to overwrite this table daily.

CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${SEED_DATASET}.dim_fx_rate` (
  date      DATE,
  currency  STRING,
  usd_rate  NUMERIC  -- units of local currency per 1 USD
)
PARTITION BY date
CLUSTER BY currency;

-- Seed rows so staging queries don't fail on first run. Replace with a daily job.
-- For the simulation demo we backfill a 2-year window (2025-01-01 .. 2026-12-31)
-- with flat indicative rates; in production, overwrite with your FX provider.
MERGE `${GCP_PROJECT}.${SEED_DATASET}.dim_fx_rate` T
USING (
  SELECT d AS date, cur AS currency, rate AS usd_rate
  FROM UNNEST(GENERATE_DATE_ARRAY(DATE '2025-01-01', DATE '2026-12-31')) AS d
  CROSS JOIN UNNEST([
    STRUCT('IDR' AS cur, 16800.0 AS rate),
    STRUCT('THB', 36.0),
    STRUCT('VND', 25400.0),
    STRUCT('MYR', 4.60),
    STRUCT('SGD', 1.33),
    STRUCT('PHP', 56.0)
  ])
) S
ON T.date = S.date AND T.currency = S.currency
WHEN NOT MATCHED THEN
  INSERT (date, currency, usd_rate) VALUES (S.date, S.currency, S.usd_rate);
