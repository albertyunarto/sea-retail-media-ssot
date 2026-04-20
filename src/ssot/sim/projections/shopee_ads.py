"""Shopee Ads — daily rows keyed by (Date, Shop_id, Ad_type, Campaign_id, Sku_id, Keyword).

Raw table: ${RAW_DATASET}.shopee_ads_daily (sql/ddl/04_raw_shopee_ads_daily.sql)
Engine channel keys: 5 shopee_ads_* channels. One engine row per
(market, date, channel) is expanded into ~4 campaigns × 2 SKUs × 2 keywords
= 16 rows per engine row, so the panel has meaningful ad-group diversity.

Voucher_subsidy comes from the engine's `voucher_subsidy_sgd` column, which
staging subtracts from Spend before FX conversion.
"""

from __future__ import annotations

import numpy as np

from ..allocators import zipf_weights
from ..config import SimConfig
from ..engine import LatentState
from ..rng import Rng
from .base import account_id_for, metadata, sgd_to_local, MARKET_CURRENCY

SOURCE = "shopee_ads"

CHANNEL_TO_AD_TYPE: dict[str, str] = {
    "shopee_ads_product_search": "product_search",
    "shopee_ads_shop_search":    "shop_search",
    "shopee_ads_targeting":      "targeting",
    "shopee_ads_gmv_max":        "gmv_max",
    "shopee_ads_affiliate":      "affiliate",
}

CAMPAIGNS_PER_AD_TYPE = 3
SKUS_PER_CAMPAIGN = 2
KEYWORDS = ["laundry detergent", "fabric softener", "shampoo", "body wash",
            "dishwash", "sunscreen", "toothpaste", "face serum"]


def project(latent: LatentState, cfg: SimConfig, rng: Rng) -> list[dict]:
    panel = latent.panel
    df = panel[panel["channel"].isin(CHANNEL_TO_AD_TYPE.keys())].reset_index(drop=True)
    if df.empty:
        return []

    brand = cfg.brand
    all_skus = brand.all_skus()
    sub_rng = rng.spawn(SOURCE)
    out: list[dict] = []

    # Keyword weights (Zipf long tail): top keyword gets most spend.
    kw_w = zipf_weights(len(KEYWORDS), a=1.3)
    kw_w = kw_w / kw_w.sum()

    for _, r in df.iterrows():
        mk = r["market"]
        d = r["date_local"]
        ad_type = CHANNEL_TO_AD_TYPE[r["channel"]]
        acct_id = account_id_for(SOURCE, mk)
        currency = MARKET_CURRENCY[mk]
        meta = metadata(
            source_name=SOURCE,
            market=mk,
            accounts=[acct_id],
            window_start=cfg.start_date,
            window_end=cfg.end_date,
        )

        n_slots = CAMPAIGNS_PER_AD_TYPE * SKUS_PER_CAMPAIGN * len(KEYWORDS)
        rr = sub_rng.spawn(f"{mk}:{d}:{ad_type}:props")
        props = rr.dirichlet(np.ones(n_slots) * 2.5)

        fx_spend = sgd_to_local(mk, float(r["spend_sgd"]))
        fx_voucher = sgd_to_local(mk, float(r["voucher_subsidy_sgd"]))
        fx_gmv = sgd_to_local(mk, float(r["ads_attributed_gmv_sgd"]))

        # Pick SKUs for this ad_type — deterministic but varied per market/ad_type.
        sku_rng = sub_rng.spawn(f"{mk}:{ad_type}:skus")
        sku_picks = [all_skus[int(i)] for i in sku_rng.gen.choice(
            len(all_skus), size=CAMPAIGNS_PER_AD_TYPE * SKUS_PER_CAMPAIGN, replace=False
        )]

        slot = 0
        for camp_idx in range(CAMPAIGNS_PER_AD_TYPE):
            camp_id = f"{acct_id}-{ad_type}-{camp_idx+1:02d}"
            camp_name = f"Elysium {ad_type.replace('_', ' ').title()} Campaign {camp_idx+1}"
            for sku_idx in range(SKUS_PER_CAMPAIGN):
                sku = sku_picks[camp_idx * SKUS_PER_CAMPAIGN + sku_idx]
                for kw_idx, kw in enumerate(KEYWORDS):
                    # Bias the keyword weight by Zipf + Dirichlet split.
                    p_slot = float(props[slot]) * float(kw_w[kw_idx])
                    slot += 1
                    if p_slot <= 0:
                        continue
                    spend_loc = fx_spend * p_slot
                    voucher_loc = fx_voucher * p_slot
                    impressions = int(round(int(r["impressions"]) * p_slot))
                    clicks = int(round(int(r["clicks"]) * p_slot))
                    direct_orders = int(round(int(r["ads_attributed_orders"]) * p_slot * 0.6))
                    broad_orders = int(round(int(r["ads_attributed_orders"]) * p_slot))
                    direct_gmv_loc = fx_gmv * p_slot * 0.6
                    broad_gmv_loc = fx_gmv * p_slot
                    out.append({
                        "Date":               d.isoformat(),
                        "Shop_id":            acct_id,
                        "Country":            mk,
                        "Currency":           currency,
                        "Ad_type":            ad_type,
                        "Campaign_id":        camp_id,
                        "Campaign_name":      camp_name,
                        "Sku_id":             sku.sku_id,
                        "Keyword":            kw,
                        "Match_type":         "broad" if kw_idx % 2 else "exact",
                        "Spend":              round(spend_loc, 2),
                        "Voucher_subsidy":    round(voucher_loc, 2),
                        "Impressions":        impressions,
                        "Clicks":             clicks,
                        "Direct_orders":      direct_orders,
                        "Broad_orders":       broad_orders,
                        "Direct_gmv":         round(direct_gmv_loc, 2),
                        "Broad_gmv":          round(broad_gmv_loc, 2),
                        "Attribution_window": "7d",
                        **meta,
                    })
    return out
