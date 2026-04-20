-- Invariant: spend/impressions/clicks/orders/gmv are never negative.
-- Returns ZERO rows on pass.
SELECT date_local, market, channel,
       spend_usd, impressions, clicks, ads_attributed_orders, ads_attributed_gmv_usd
FROM `${GCP_PROJECT}.${MART_DATASET}.daily_channel_panel`
WHERE spend_usd < 0
   OR impressions < 0
   OR clicks < 0
   OR ads_attributed_orders < 0
   OR ads_attributed_gmv_usd < 0;
