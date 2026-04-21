-- Market-specific calendar events that get joined into mart.daily_channel_panel
-- as the `is_mega_sale` flag. Covers the simulation demo horizon
-- (2025-10-01 → 2026-12-31) with the SEA retail calendar from
-- config/sim/seasonality.yaml.
--
-- Grain: one row per (date, market, event_name). A single date can appear
-- across all six markets (e.g. 11.11) or in a subset (e.g. Harbolnas → ID only).

CREATE OR REPLACE TABLE `${GCP_PROJECT}.${SEED_DATASET}.seed_calendar_events` AS
WITH mkts AS (
  SELECT 'ID' AS market UNION ALL SELECT 'TH' UNION ALL SELECT 'VN'
  UNION ALL SELECT 'MY' UNION ALL SELECT 'SG' UNION ALL SELECT 'PH'
),
cross_market_events AS (
  -- Pan-SEA mega-sales — all 6 markets.
  SELECT d AS date, m.market, name AS event_name, 'mega_sale' AS event_kind
  FROM mkts m
  CROSS JOIN UNNEST([
    STRUCT(DATE '2025-11-11' AS d, '11.11'  AS name),
    STRUCT(DATE '2025-12-12',      '12.12'),
    STRUCT(DATE '2026-01-01',      '1.1'),
    STRUCT(DATE '2026-02-02',      '2.2'),
    STRUCT(DATE '2026-03-03',      '3.3'),
    STRUCT(DATE '2026-04-04',      '4.4'),
    STRUCT(DATE '2026-05-05',      '5.5'),
    STRUCT(DATE '2026-06-06',      '6.6'),
    STRUCT(DATE '2026-07-07',      '7.7'),
    STRUCT(DATE '2026-08-08',      '8.8'),
    STRUCT(DATE '2026-09-09',      '9.9'),
    STRUCT(DATE '2026-10-10',      '10.10'),
    STRUCT(DATE '2026-11-11',      '11.11'),
    STRUCT(DATE '2026-12-12',      '12.12')
  ]) AS d
)
SELECT date, market, event_name, event_kind FROM cross_market_events
UNION ALL
-- Harbolnas (Indonesia mega-sale week, Dec).
SELECT d, 'ID', 'Harbolnas', 'mega_sale' FROM UNNEST(
  GENERATE_DATE_ARRAY(DATE '2025-12-10', DATE '2025-12-15')
) AS d
UNION ALL
SELECT d, 'ID', 'Harbolnas', 'mega_sale' FROM UNNEST(
  GENERATE_DATE_ARRAY(DATE '2026-12-10', DATE '2026-12-15')
) AS d
UNION ALL
-- Christmas / end-of-year uplift, SG / MY / PH.
SELECT d, m, 'Christmas', 'festival'
FROM UNNEST(GENERATE_DATE_ARRAY(DATE '2025-12-20', DATE '2025-12-26')) AS d
CROSS JOIN UNNEST(['SG', 'MY', 'PH']) AS m
UNION ALL
SELECT d, m, 'Christmas', 'festival'
FROM UNNEST(GENERATE_DATE_ARRAY(DATE '2026-12-20', DATE '2026-12-26')) AS d
CROSS JOIN UNNEST(['SG', 'MY', 'PH']) AS m
UNION ALL
-- Chinese New Year / Lunar New Year 2026 — multi-day lead-up + peak.
SELECT d, m, 'CNY', 'festival'
FROM UNNEST(GENERATE_DATE_ARRAY(DATE '2026-02-10', DATE '2026-02-19')) AS d
CROSS JOIN UNNEST(['SG', 'MY', 'VN', 'PH', 'TH']) AS m
UNION ALL
-- Tet (Vietnam, Feb 2026).
SELECT d, 'VN', 'Tet', 'festival' FROM UNNEST(
  GENERATE_DATE_ARRAY(DATE '2026-02-15', DATE '2026-02-22')
) AS d
UNION ALL
-- Ramadan 2026 + Lebaran / Hari Raya — ID + MY, Feb 18 to Mar 22.
SELECT d, m, 'Ramadan', 'ramadan'
FROM UNNEST(GENERATE_DATE_ARRAY(DATE '2026-02-18', DATE '2026-03-19')) AS d
CROSS JOIN UNNEST(['ID', 'MY']) AS m
UNION ALL
SELECT d, m, 'Lebaran', 'festival'
FROM UNNEST(GENERATE_DATE_ARRAY(DATE '2026-03-20', DATE '2026-03-22')) AS d
CROSS JOIN UNNEST(['ID', 'MY']) AS m
UNION ALL
-- Songkran (Thailand, mid-April).
SELECT d, 'TH', 'Songkran', 'festival' FROM UNNEST(
  GENERATE_DATE_ARRAY(DATE '2026-04-13', DATE '2026-04-15')
) AS d
;
