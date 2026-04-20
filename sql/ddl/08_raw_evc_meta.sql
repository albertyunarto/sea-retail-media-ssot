-- Custom Meta Marketing API extension for Engaged-View Conversions.
-- Mirrors `action_attribution_windows` breakdown. Post-January-2026, Meta only
-- returns 1d_click | 7d_click | 1d_view | 1d_ev — the deprecated 7d_view /
-- 28d_view windows are NOT emitted (invariant).

CREATE TABLE IF NOT EXISTS `${GCP_PROJECT}.${EVC_DATASET}.evc_meta` (
  date                 DATE,
  account_id           STRING,
  campaign_id          STRING,
  campaign_name        STRING,
  adset_id             STRING,
  attribution_window   STRING,  -- 1d_click | 7d_click | 1d_view | 1d_ev
  action_type          STRING,  -- purchase | add_to_cart
  action_count         INT64,
  action_value         NUMERIC,
  _source_system       STRING,  -- 'custom_meta_marketing_api_sim'
  _market              STRING,
  _accounts            STRING,
  _window_start        DATE,
  _window_end          DATE,
  ingested_at          TIMESTAMP
)
PARTITION BY DATE(ingested_at)
CLUSTER BY _market, account_id, campaign_id;
