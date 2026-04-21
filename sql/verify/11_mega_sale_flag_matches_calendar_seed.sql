-- Invariant: mart.daily_channel_panel.is_mega_sale == TRUE
-- iff (date_local, market) appears in seeds.seed_calendar_events.
-- Returns ZERO rows on pass; mismatches appear as rows.
WITH panel_days AS (
  SELECT DISTINCT date_local AS date, market, is_mega_sale
  FROM `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel`
),
seed_days AS (
  SELECT DISTINCT date, market, TRUE AS in_seed
  FROM `${GCP_PROJECT}.${SEED_DATASET}.seed_calendar_events`
)
SELECT
  p.date,
  p.market,
  p.is_mega_sale   AS panel_flag,
  s.in_seed        AS seed_says_mega_sale
FROM panel_days p
LEFT JOIN seed_days s
  ON s.date = p.date AND s.market = p.market
WHERE p.is_mega_sale IS DISTINCT FROM COALESCE(s.in_seed, FALSE);
