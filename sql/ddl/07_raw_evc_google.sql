-- Custom Google Ads API extension for Engaged-View Conversions (EVC).
-- Mirrors what a direct `segments.ad_event_type` pull would return.
-- ad_event_type enum: 'click_through' | 'engaged_view' | 'view_through' | 'impression'
-- (Supermetrics does not expose this; hence the `custom_apis` dataset separation.)

CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${EVC_DATASET}.evc_google` (
  date                  DATE,
  customer_id           STRING,
  campaign_id           STRING,
  campaign_name         STRING,
  campaign_type         STRING,     -- SEARCH, PMAX, DEMAND_GEN, VIDEO
  ad_event_type         STRING,     -- click_through | engaged_view | view_through
  conversions           FLOAT64,
  conversions_value     NUMERIC,
  all_conversions       FLOAT64,
  all_conversions_value NUMERIC,
  _source_system        STRING,     -- 'custom_google_ads_api_sim'
  _market               STRING,
  _accounts             STRING,
  _window_start         DATE,
  _window_end           DATE,
  ingested_at           TIMESTAMP
)
PARTITION BY DATE(ingested_at)
CLUSTER BY _market, customer_id, campaign_id;
