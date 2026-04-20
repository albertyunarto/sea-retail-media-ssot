"""Google Ads (Shopee campaigns) — daily rows keyed by (Date, Customer_id, Campaign_id, Ad_group_id, Keyword).

Raw table: ${RAW_DATASET}.google_ads_shopee_daily (sql/ddl/06_raw_google_ads_shopee_daily.sql)
Staging filter requires `Campaign_name STARTS_WITH "SHP_"`, so every emitted
row respects that convention. Campaign_type is split across SEARCH / PMAX /
SHOPPING / DEMAND_GEN / VIDEO with upper-funnel types (DEMAND_GEN, VIDEO)
getting disproportionate EVC contribution — important for the PRD-B dashboard
story.
"""

from __future__ import annotations

import numpy as np

from ..allocators import GOOGLE_CAMPAIGN_TYPE_WEIGHTS, GOOGLE_CAMPAIGN_TYPES
from ..config import SimConfig
from ..engine import LatentState
from ..rng import Rng
from .base import account_id_for, metadata, sgd_to_local, MARKET_CURRENCY

SOURCE = "google_ads_shopee"

KEYWORDS_SEARCH = [
    "shopee laundry", "shopee dishwash", "elysium detergent",
    "elysium shampoo", "elysium sunscreen",
]
AD_GROUPS_PER_CAMPAIGN = 2


def project(latent: LatentState, cfg: SimConfig, rng: Rng) -> list[dict]:
    df = latent.panel[latent.panel["channel"] == "google_ads_shopee"].reset_index(drop=True)
    if df.empty:
        return []

    sub_rng = rng.spawn(SOURCE)
    out: list[dict] = []
    type_weights = np.array([GOOGLE_CAMPAIGN_TYPE_WEIGHTS[t] for t in GOOGLE_CAMPAIGN_TYPES])
    type_weights = type_weights / type_weights.sum()

    for _, r in df.iterrows():
        mk = r["market"]
        d = r["date_local"]
        cust_id = account_id_for(SOURCE, mk)
        currency = MARKET_CURRENCY[mk]
        fx_spend = sgd_to_local(mk, float(r["spend_sgd"]))
        fx_value = sgd_to_local(mk, float(r["ads_attributed_gmv_sgd"]))
        total_impr = int(r["impressions"])
        total_clicks = int(r["clicks"])
        total_orders = int(r["ads_attributed_orders"])
        total_all_conv = float(r["all_conversions"])

        meta = metadata(
            source_name=SOURCE, market=mk, accounts=[cust_id],
            window_start=cfg.start_date, window_end=cfg.end_date,
        )

        # Allocate the (market, date) totals across 5 campaign_types.
        for t_idx, camp_type in enumerate(GOOGLE_CAMPAIGN_TYPES):
            p_type = float(type_weights[t_idx])
            camp_id = f"cmp_{mk.lower()}_{camp_type.lower()}_01"
            camp_name = f"SHP_{camp_type}_{mk}_Always_On"
            # Sub-split across ad_groups (Dirichlet)
            ag_props = sub_rng.spawn(f"{mk}:{d}:{camp_type}:ag").dirichlet(
                np.ones(AD_GROUPS_PER_CAMPAIGN) * 4.0
            )

            keywords = KEYWORDS_SEARCH if camp_type == "SEARCH" else [""]
            # keyword weights
            kw_rng = sub_rng.spawn(f"{mk}:{d}:{camp_type}:kw")
            if len(keywords) > 1:
                kw_w = kw_rng.dirichlet(np.ones(len(keywords)) * 3.0)
            else:
                kw_w = np.array([1.0])

            for ag_idx in range(AD_GROUPS_PER_CAMPAIGN):
                ag_id = f"{camp_id}_ag{ag_idx+1:02d}"
                for kw_idx, kw in enumerate(keywords):
                    p = p_type * float(ag_props[ag_idx]) * float(kw_w[kw_idx])
                    if p <= 0:
                        continue
                    spend_loc = fx_spend * p
                    cost_micros = int(round(spend_loc * 1_000_000))
                    impressions = int(round(total_impr * p))
                    clicks = int(round(total_clicks * p))
                    conv = total_orders * p
                    all_conv = total_all_conv * p
                    final_url = f"https://shopee.{mk.lower()}.sim/elysium"
                    out.append({
                        "Date":              d.isoformat(),
                        "Customer_id":       cust_id,
                        "Campaign_id":       camp_id,
                        "Campaign_name":     camp_name,
                        "Campaign_type":     camp_type,
                        "Ad_group_id":       ag_id,
                        "Ad_group_name":     f"AG {ag_idx+1}",
                        "Keyword":           kw,
                        "Final_url":         final_url,
                        "Country":           mk,
                        "Currency":          currency,
                        "Cost_micros":       cost_micros,
                        "Spend":             round(spend_loc, 2),
                        "Impressions":       impressions,
                        "Clicks":            clicks,
                        "Conversions":       round(conv, 4),
                        "Conversion_value":  round(fx_value * p, 2),
                        "All_conversions":   round(all_conv, 4),
                        "Attribution_model": "DATA_DRIVEN",
                        **meta,
                    })
    return out
