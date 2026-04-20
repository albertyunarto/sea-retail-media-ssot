"""Lock in the PRD-A demo narrative ordering at the prior level.

The demo story (per user instruction) is:
  1. Google Ads — highest share of wallet AND highest ROAS
  2. Shopee Ads (sum of 5 ad_types) — second share of wallet
  3. Meta CPAS — third
  4. TikTok Ads — small, not over-highlighted

If someone bumps a daily_spend_sgd_baseline or a baseline_roas and breaks
this ordering, these tests catch it at YAML-load time (no engine run needed).
"""

from __future__ import annotations

from ssot.sim.config import load_priors


def _google():      return load_priors().channels["google_ads_shopee"]
def _tiktok():      return load_priors().channels["tiktok_ads"]
def _meta():        return load_priors().channels["meta_cpas"]
def _shopee_ads():
    p = load_priors().channels
    return [p[n] for n in p if n.startswith("shopee_ads_")]


def test_google_has_largest_daily_spend_baseline():
    """Google wallet share must be the largest of any single channel."""
    g = _google().daily_spend_sgd_baseline
    for ch_name, ch in load_priors().channels.items():
        if ch_name == "google_ads_shopee":
            continue
        assert g > ch.daily_spend_sgd_baseline, (
            f"Google ({g}) must outspend {ch_name} ({ch.daily_spend_sgd_baseline})"
        )


def test_shopee_ads_aggregate_is_second_largest():
    """Aggregate Shopee Ads (sum of 5 ad_types) sits between Google and Meta."""
    google = _google().daily_spend_sgd_baseline
    shopee = sum(c.daily_spend_sgd_baseline for c in _shopee_ads())
    meta = _meta().daily_spend_sgd_baseline
    tiktok = _tiktok().daily_spend_sgd_baseline
    assert google > shopee, f"Google ({google}) should outspend Shopee Ads aggregate ({shopee})"
    assert shopee > meta, f"Shopee Ads aggregate ({shopee}) should outspend Meta ({meta})"
    assert meta > tiktok, f"Meta ({meta}) should outspend TikTok ({tiktok})"


def test_google_has_highest_baseline_roas_among_off_platform():
    """Off-platform channels: Google must have the highest baseline_roas among
    {google, meta, tiktok}."""
    g = _google().baseline_roas
    m = _meta().baseline_roas
    t = _tiktok().baseline_roas
    # Narrative lock: Google > Meta > TikTok on baseline ROAS.
    assert g > m, f"Google baseline ROAS ({g}) must exceed Meta ({m})"
    assert g > t, f"Google baseline ROAS ({g}) must exceed TikTok ({t})"
    # Meta is a strong second, but the story is "Google wins" — Meta below Google.
    assert m > t, f"Meta baseline ROAS ({m}) must exceed TikTok ({t})"


def test_tiktok_ads_baseline_roas_stays_in_lower_half_of_band():
    """TikTok Ads is intentionally muted; baseline should not float above the
    midpoint of its band or the demo over-credits TikTok."""
    t = _tiktok()
    lo, hi = t.roas_band
    midpoint = (lo + hi) / 2.0
    assert t.baseline_roas <= midpoint, (
        f"TikTok baseline_roas ({t.baseline_roas}) must stay <= band midpoint ({midpoint}) "
        f"to keep the demo narrative focused on Google/Shopee/Meta"
    )


def test_tiktok_ads_spend_is_smallest_among_off_platform_channels():
    """TikTok wallet share must be the smallest of the 3 off-platform channels."""
    t = _tiktok().daily_spend_sgd_baseline
    m = _meta().daily_spend_sgd_baseline
    g = _google().daily_spend_sgd_baseline
    assert t < m, f"TikTok ({t}) must spend less than Meta ({m})"
    assert t < g, f"TikTok ({t}) must spend less than Google ({g})"
