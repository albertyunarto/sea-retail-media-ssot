-- Invariant: post-January-2026 Meta only returns 1d_click | 7d_click | 1d_view | 1d_ev.
-- The generator must never emit the deprecated 7d_view / 28d_view windows.
-- Returns ZERO rows on pass.
SELECT DISTINCT attribution_window
FROM `${GCP_PROJECT}.${EVC_DATASET}.evc_meta`
WHERE attribution_window NOT IN ('1d_click', '7d_click', '1d_view', '1d_ev');
