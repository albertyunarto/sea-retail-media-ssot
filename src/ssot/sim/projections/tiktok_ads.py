"""TikTok Ads — daily campaign / ad_group / ad rows.

Raw table: ${RAW_DATASET}.tiktok_ads_daily (see sql/ddl/02_raw_tiktok_ads_daily.sql)
Engine channel key: 'tiktok_ads'. One engine row per (market, date) is
disaggregated across 4 campaigns × 2 ad_groups × 2 ads = 16 output rows per
(market, date) so the panel has meaningful campaign diversity.
"""

from __future__ import annotations

import numpy as np

from ..config import SimConfig
from ..engine import LatentState
from ..rng import Rng
from .base import account_id_for, metadata, sgd_to_local, MARKET_CURRENCY

SOURCE = "tiktok_ads"

# Campaign / ad_group / ad layout (small and stable per market).
CAMPAIGNS = [
    ("Brand-Always-On",        "VIDEO"),
    ("PromoPush-MegaSale",     "VIDEO"),
    ("LaunchBoost-Serum",      "VIDEO"),
    ("DailyCreative-Rotation", "VIDEO"),
]
AD_GROUPS_PER_CAMPAIGN = 2
ADS_PER_AD_GROUP = 2


def project(latent: LatentState, cfg: SimConfig, rng: Rng) -> list[dict]:
    panel = latent.panel
    df = panel[panel["channel"] == "tiktok_ads"].reset_index(drop=True)
    if df.empty:
        return []

    out: list[dict] = []
    sub_rng = rng.spawn(SOURCE)

    for _, r in df.iterrows():
        mk = r["market"]
        d = r["date_local"]
        # Split spend/impressions/clicks/orders across 4 campaigns × 2 × 2 ads
        # using Dirichlet proportions (concentration favours even split).
        n_slots = len(CAMPAIGNS) * AD_GROUPS_PER_CAMPAIGN * ADS_PER_AD_GROUP  # 16
        props = sub_rng.spawn(f"{mk}:{d}:props").dirichlet(np.ones(n_slots) * 4.0)

        acct_id = account_id_for(SOURCE, mk)
        currency = MARKET_CURRENCY[mk]
        fx_spend_local = sgd_to_local(mk, float(r["spend_sgd"]))
        fx_value_local = sgd_to_local(mk, float(r["ads_attributed_gmv_sgd"]))
        meta = metadata(
            source_name=SOURCE,
            market=mk,
            accounts=[acct_id],
            window_start=cfg.start_date,
            window_end=cfg.end_date,
        )

        slot = 0
        for camp_idx, (camp_name, objective) in enumerate(CAMPAIGNS):
            camp_id = f"{acct_id}-cmp-{camp_idx+1:02d}"
            for ag_idx in range(AD_GROUPS_PER_CAMPAIGN):
                ag_id = f"{camp_id}-ag-{ag_idx+1:02d}"
                for ad_idx in range(ADS_PER_AD_GROUP):
                    p = float(props[slot])
                    slot += 1
                    spend_loc = fx_spend_local * p
                    impressions = int(round(int(r["impressions"]) * p))
                    clicks = int(round(int(r["clicks"]) * p))
                    pay = int(round(int(r["ads_attributed_orders"]) * p))
                    pay_value_loc = fx_value_local * p
                    ctr = (clicks / impressions) if impressions > 0 else 0.0
                    cpc = (spend_loc / clicks) if clicks > 0 else 0.0
                    row = {
                        "Date":                          d.isoformat(),
                        "Advertiser_id":                 acct_id,
                        "Campaign_id":                   camp_id,
                        "Campaign_name":                 camp_name,
                        "Objective_type":                objective,
                        "Ad_group_id":                   ag_id,
                        "Ad_group_name":                 f"{camp_name} / AG{ag_idx+1}",
                        "Ad_id":                         f"{ag_id}-ad-{ad_idx+1:02d}",
                        "Ad_name":                       f"{camp_name} creative {ad_idx+1}",
                        "Country_code":                  mk,
                        "Currency":                      currency,
                        "Spend":                         round(spend_loc, 2),
                        "Impressions":                   impressions,
                        "Clicks":                        clicks,
                        "Ctr":                           round(ctr, 6),
                        "Cpc":                           round(cpc, 4),
                        "Video_play_6s":                 int(round(clicks * 0.3)),
                        "Complete_payment":              pay,
                        "Complete_payment_value":        round(pay_value_loc, 2),
                        "Skan_complete_payment":         0,
                        "Conversion_attribution_window": "7d_click_1d_view",
                        **meta,
                    }
                    out.append(row)
    return out
