-- Invariant: every market from dim_market appears in the panel.
-- Returns ZERO rows on pass (markets missing from the panel show as rows).
SELECT dm.market
FROM `${GCP_PROJECT}.${SEED_DATASET}.dim_market` dm
WHERE dm.market NOT IN (
  SELECT DISTINCT market FROM `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel`
);
