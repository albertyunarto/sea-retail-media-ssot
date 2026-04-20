-- Unified EVC staging view — normalises the three custom-API raw tables to
-- a common shape (date_local, market, channel, attribution_bucket, conversions).
--
-- Grain: date_local × market × channel × attribution_bucket
--   attribution_bucket:
--     'click'  = click-through conversions reported by platforms
--     'evc'    = view-assisted / engaged-view conversions (the delta)
--
-- Downstream: fact_evc MERGEs this into a dated fact; mart view joins onto
-- the existing daily_channel_panel so the dashboard can toggle EVC on/off.

CREATE OR REPLACE VIEW `${GCP_PROJECT}.${STG_DATASET}.stg_evc` AS
WITH google AS (
  SELECT
    date                         AS date_local,
    _market                      AS market,
    'google_ads_shopee'          AS channel,
    CASE ad_event_type
      WHEN 'click_through' THEN 'click'
      WHEN 'engaged_view'  THEN 'evc'
      WHEN 'view_through'  THEN 'evc'
      ELSE 'click'
    END                          AS attribution_bucket,
    SUM(all_conversions)         AS conversions,
    SUM(all_conversions_value)   AS conversion_value_local,
    ANY_VALUE(_source_system)    AS _source_system
  FROM `${GCP_PROJECT}.${EVC_DATASET}.evc_google`
  GROUP BY date_local, market, channel, attribution_bucket
),
meta AS (
  SELECT
    date                         AS date_local,
    _market                      AS market,
    'meta_cpas'                  AS channel,
    CASE attribution_window
      WHEN '1d_ev' THEN 'evc'
      ELSE 'click'
    END                          AS attribution_bucket,
    SUM(action_count)            AS conversions,
    SUM(action_value)            AS conversion_value_local,
    ANY_VALUE(_source_system)    AS _source_system
  FROM `${GCP_PROJECT}.${EVC_DATASET}.evc_meta`
  WHERE action_type = 'purchase'
  GROUP BY date_local, market, channel, attribution_bucket
),
tiktok AS (
  SELECT
    date                         AS date_local,
    _market                      AS market,
    'tiktok_ads'                 AS channel,
    CASE attribution_type
      WHEN 'EVTA' THEN 'evc'
      WHEN 'VTA'  THEN 'evc'
      ELSE 'click'
    END                          AS attribution_bucket,
    SUM(conversions)             AS conversions,
    SUM(conversion_value)        AS conversion_value_local,
    ANY_VALUE(_source_system)    AS _source_system
  FROM `${GCP_PROJECT}.${EVC_DATASET}.evc_tiktok`
  GROUP BY date_local, market, channel, attribution_bucket
)
SELECT * FROM google
UNION ALL SELECT * FROM meta
UNION ALL SELECT * FROM tiktok;
