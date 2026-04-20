-- Invariant: at the raw shopee_ads_daily grain, direct_orders <= broad_orders.
-- (Broad attribution includes direct, so broad >= direct by definition.)
-- Returns ZERO rows on pass.
SELECT Date, Shop_id, Ad_type, Campaign_id, Direct_orders, Broad_orders
FROM `${GCP_PROJECT}.${RAW_DATASET}.shopee_ads_daily`
WHERE Direct_orders > Broad_orders;
