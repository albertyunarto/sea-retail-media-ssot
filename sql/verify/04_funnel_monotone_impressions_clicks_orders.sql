-- Invariant: impressions >= clicks >= ads_attributed_orders per row.
-- Organic rows have NULL impressions/clicks (not ads), so filter to spend>0.
-- Returns ZERO rows on pass.
SELECT date_local, market, channel, impressions, clicks, ads_attributed_orders
FROM `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel`
WHERE spend_usd > 0
  AND (impressions < clicks OR clicks < ads_attributed_orders);
