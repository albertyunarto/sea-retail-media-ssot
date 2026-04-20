-- Invariant: every channel in the mart panel is in seed_channel_taxonomy
-- (unknown channels would break the dashboard's colour scheme).
-- Returns ZERO rows on pass. '_other' suffixed channels are expected fallbacks
-- from the mart CASE and also tolerated.
SELECT DISTINCT p.channel
FROM `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel` p
LEFT JOIN `${GCP_PROJECT}.${SEED_DATASET}.seed_channel_taxonomy` t
  ON t.channel = p.channel
WHERE t.channel IS NULL
  AND NOT ENDS_WITH(p.channel, '_other');
