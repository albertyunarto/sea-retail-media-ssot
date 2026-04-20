-- Invariant: per row in daily_channel_panel_evc, evc_conversions <= all_conversions.
-- Returns ZERO rows on pass; any returned row is a violation.
SELECT
  date_local, market, channel,
  evc_conversions, all_conversions, reported_conversions
FROM `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel_evc`
WHERE evc_conversions > all_conversions + 1e-6;
