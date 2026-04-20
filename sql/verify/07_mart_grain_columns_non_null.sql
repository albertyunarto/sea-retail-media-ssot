-- Invariant: grain columns (date_local, market, channel) must be non-null on
-- every mart row. Returns ZERO rows on pass.
SELECT *
FROM `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel`
WHERE date_local IS NULL
   OR market IS NULL
   OR channel IS NULL;
