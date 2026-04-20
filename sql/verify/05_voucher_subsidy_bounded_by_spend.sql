-- Invariant: for Shopee Ads raw rows, Voucher_subsidy <= Spend.
-- Returns ZERO rows on pass.
SELECT Date, Shop_id, Campaign_id, Ad_type, Spend, Voucher_subsidy
FROM `${GCP_PROJECT}.${RAW_DATASET}.shopee_ads_daily`
WHERE Voucher_subsidy > Spend + 1e-6;
