"""Meta CPAS — daily rows keyed by (Date, Account_id, Campaign_id, Adset_id, Ad_id).

Raw table: ${RAW_DATASET}.meta_cpas_daily (sql/ddl/05_raw_meta_cpas_daily.sql)
Staging filters to `Objective CONTAINS CATALOG_SALES`, so all emitted rows
carry Objective='CATALOG_SALES' with a synthetic catalog_id per market.
"""

from __future__ import annotations

import numpy as np

from ..config import SimConfig
from ..engine import LatentState
from ..rng import Rng
from .base import account_id_for, metadata, sgd_to_local, MARKET_CURRENCY

SOURCE = "meta_cpas"

CAMPAIGNS = [
    "CPAS-ShopeePH-Always-On",
    "CPAS-ShopeePH-MegaSale",
    "CPAS-Retargeting-28d",
    "CPAS-NewCustomer-Acquisition",
]
ADSETS_PER_CAMPAIGN = 2
ADS_PER_ADSET = 2


def project(latent: LatentState, cfg: SimConfig, rng: Rng) -> list[dict]:
    df = latent.panel[latent.panel["channel"] == "meta_cpas"].reset_index(drop=True)
    if df.empty:
        return []

    sub_rng = rng.spawn(SOURCE)
    out: list[dict] = []
    n_slots = len(CAMPAIGNS) * ADSETS_PER_CAMPAIGN * ADS_PER_ADSET  # 16

    for _, r in df.iterrows():
        mk = r["market"]
        d = r["date_local"]
        acct_id = account_id_for(SOURCE, mk).replace("act-sim", "act").replace("-", "_")
        currency = MARKET_CURRENCY[mk]
        catalog_id = f"cat_{mk.lower()}_elysium_{cfg.brand.name.lower().replace(' ', '_')}"
        partner_id = f"partner_shopee_{mk.lower()}"

        props = sub_rng.spawn(f"{mk}:{d}:props").dirichlet(np.ones(n_slots) * 4.0)

        fx_spend = sgd_to_local(mk, float(r["spend_sgd"]))
        fx_value = sgd_to_local(mk, float(r["ads_attributed_gmv_sgd"]))
        meta = metadata(
            source_name=SOURCE, market=mk, accounts=[acct_id],
            window_start=cfg.start_date, window_end=cfg.end_date,
        )

        slot = 0
        for camp_idx, camp_name in enumerate(CAMPAIGNS):
            camp_id = f"cmp_{mk.lower()}_{camp_idx+1:03d}"
            for adset_idx in range(ADSETS_PER_CAMPAIGN):
                adset_id = f"{camp_id}_as{adset_idx+1:02d}"
                for ad_idx in range(ADS_PER_ADSET):
                    p = float(props[slot])
                    slot += 1
                    spend_loc = fx_spend * p
                    impressions = int(round(int(r["impressions"]) * p))
                    reach = int(round(impressions * 0.6))  # ~60% reach / impressions
                    link_clicks = int(round(int(r["clicks"]) * p))
                    add_to_cart = int(round(link_clicks * 0.35))
                    purchase = int(round(int(r["ads_attributed_orders"]) * p))
                    purchase_value = fx_value * p
                    roas = (purchase_value / spend_loc) if spend_loc > 0 else 0.0
                    out.append({
                        "Date":               d.isoformat(),
                        "Account_id":         acct_id,
                        "Campaign_id":        camp_id,
                        "Campaign_name":      camp_name,
                        "Adset_id":           adset_id,
                        "Adset_name":         f"{camp_name} / Adset {adset_idx+1}",
                        "Ad_id":              f"{adset_id}_ad{ad_idx+1:02d}",
                        "Objective":          "CATALOG_SALES",
                        "Catalog_id":         catalog_id,
                        "Partner_id":         partner_id,
                        "Country":            mk,
                        "Currency":           currency,
                        "Spend":              round(spend_loc, 2),
                        "Impressions":        impressions,
                        "Reach":              reach,
                        "Link_clicks":        link_clicks,
                        "Add_to_cart":        add_to_cart,
                        "Purchase":           purchase,
                        "Purchase_value":     round(purchase_value, 2),
                        "Roas":               round(roas, 4),
                        "Attribution_window": "7d_click_1d_view",
                        **meta,
                    })
    return out
