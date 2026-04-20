-- Custom TikTok Marketing API extension for Engaged-View Conversions.
-- attribution_type enum: 'CTA' | 'VTA' | 'EVTA'  (Click / View / Engaged-View
-- Through Attribution). EVTA has its own 6-second qualifying threshold and
-- a configurable window of 1, 7, or 28 days (TikTok documented range).

CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${EVC_DATASET}.evc_tiktok` (
  date                   DATE,
  advertiser_id          STRING,
  campaign_id            STRING,
  adgroup_id             STRING,
  attribution_type       STRING,    -- CTA | VTA | EVTA
  attribution_window_days INT64,    -- 1, 7, or 28
  conversions            INT64,
  conversion_value       NUMERIC,
  _source_system         STRING,    -- 'custom_tiktok_ads_api_sim'
  _market                STRING,
  _accounts              STRING,
  _window_start          DATE,
  _window_end            DATE,
  ingested_at            TIMESTAMP
)
PARTITION BY DATE(ingested_at)
CLUSTER BY _market, advertiser_id, campaign_id;
