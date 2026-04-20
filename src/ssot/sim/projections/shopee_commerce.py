"""Shopee Commerce — order-line rows (one row per Order_sn × Sku).

Raw table: ${RAW_DATASET}.shopee_orders (sql/ddl/03_raw_shopee_orders.sql)

Grain: one row per order line. For each (market, date) we take the platform
total orders (organic + ads-attributed for the shopee anchor) and generate
that many orders, each with 1-2 SKUs. Traffic_source drawn from the canonical
distribution in seed_traffic_source (organic / search / feed / recommendation
/ ads / affiliate).
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

import numpy as np

from ..allocators import SHOPEE_TRAFFIC_WEIGHTS
from ..config import SimConfig
from ..engine import LatentState
from ..rng import Rng
from .base import account_id_for, metadata, sgd_to_local, MARKET_CURRENCY

SOURCE = "shopee_commerce"
AOV_SGD = 40.0


def project(latent: LatentState, cfg: SimConfig, rng: Rng) -> list[dict]:
    organic = latent.organic[latent.organic["anchor_platform"] == "shopee"].reset_index(drop=True)
    if organic.empty:
        return []

    shopee_ads = latent.panel[latent.panel["anchor_platform"] == "shopee"].copy()
    ads_orders = (shopee_ads.groupby(["market", "date_local"], as_index=False)
                  ["ads_attributed_orders"].sum()
                  .rename(columns={"ads_attributed_orders": "ads_orders"}))
    plat = organic.merge(ads_orders, on=["market", "date_local"], how="left")
    plat["ads_orders"] = plat["ads_orders"].fillna(0).astype(int)
    plat["total_orders"] = plat["platform_total_orders"].astype(int) + plat["ads_orders"]

    sub_rng = rng.spawn(SOURCE)
    traffic_names = list(SHOPEE_TRAFFIC_WEIGHTS.keys())
    traffic_w = np.array(list(SHOPEE_TRAFFIC_WEIGHTS.values()), dtype=float)
    traffic_w = traffic_w / traffic_w.sum()

    all_skus = cfg.brand.all_skus()
    sku_w = np.zeros(len(all_skus), dtype=float)
    for i, s in enumerate(all_skus):
        cat = next(c for c in cfg.brand.categories if c.id == s.category)
        sku_w[i] = cat.base_demand_share / len(cat.skus)
    sku_cdf = np.cumsum(sku_w / sku_w.sum())
    sku_price_local_cache: dict[tuple[str, int], float] = {}

    out: list[dict] = []
    for _, r in plat.iterrows():
        mk = r["market"]
        d = r["date_local"]
        n_orders = int(r["total_orders"])
        if n_orders == 0:
            continue

        shop_id = account_id_for(SOURCE, mk)
        currency = MARKET_CURRENCY[mk]
        meta = metadata(
            source_name=SOURCE, market=mk, accounts=[shop_id],
            window_start=cfg.start_date, window_end=cfg.end_date,
        )
        date_str = d.isoformat()
        date_prefix = d.strftime("%Y%m%d")

        gen = sub_rng.spawn(f"{mk}:{d}").gen
        u_lines = gen.uniform(size=n_orders)
        u_traffic = gen.uniform(size=n_orders)
        secs = gen.uniform(0, 86400, size=n_orders).astype(np.int64)
        u_status = gen.uniform(size=n_orders)
        u_voucher = gen.uniform(size=n_orders)
        u_sku = gen.uniform(size=n_orders * 2)
        u_qty = gen.uniform(size=n_orders * 2)

        lines_per_order = np.where(u_lines < 0.15, 2, 1)
        traffic_idx = np.searchsorted(np.cumsum(traffic_w), u_traffic)
        sku_idx_all = np.searchsorted(sku_cdf, u_sku)
        day_start = datetime.combine(d, time.min, tzinfo=timezone.utc)
        voucher_seller_amount = sgd_to_local(mk, AOV_SGD * 0.1)

        line_cursor = 0
        for o_idx in range(n_orders):
            ts = day_start + timedelta(seconds=int(secs[o_idx]))
            ts_iso = ts.isoformat()
            if u_status[o_idx] < 0.95:
                status = "completed"
                complete_time_iso = (ts + timedelta(days=2)).isoformat()
                logistics = "delivered"
                pay_iso = ts_iso
            elif u_status[o_idx] < 0.98:
                status = "cancelled"
                complete_time_iso = None
                logistics = "cancelled"
                pay_iso = None
            else:
                status = "in_progress"
                complete_time_iso = None
                logistics = "to_ship"
                pay_iso = ts_iso
            traffic_source = traffic_names[int(traffic_idx[o_idx])]
            voucher_seller = voucher_seller_amount if u_voucher[o_idx] < 0.3 else 0.0

            order_id = f"shp-{mk}-{date_prefix}-{o_idx:05d}"
            n_lines = int(lines_per_order[o_idx])
            for line_idx in range(n_lines):
                c = line_cursor
                line_cursor += 1
                sku = all_skus[int(sku_idx_all[c])]
                qty = 1 if u_qty[c] >= 0.20 else 2

                cache_key = (mk, int(sku_idx_all[c]))
                unit_local = sku_price_local_cache.get(cache_key)
                if unit_local is None:
                    unit_local = sgd_to_local(mk, sku.unit_price_sgd)
                    sku_price_local_cache[cache_key] = unit_local

                merch_subtotal = unit_local * qty
                escrow = merch_subtotal * 0.93 - voucher_seller
                out.append({
                    "Date":                 date_str,
                    "Order_sn":             order_id,
                    "Order_status":         status,
                    "Create_time":          ts_iso,
                    "Pay_time":             pay_iso,
                    "Complete_time":        complete_time_iso,
                    "Buyer_id_hash":        f"hash_{mk}_{o_idx % 50000:05d}",
                    "Shop_id":              shop_id,
                    "Country":              mk,
                    "Sku":                  sku.sku_id,
                    "Item_id":              sku.sku_id + "_item",
                    "Quantity":             qty,
                    "Merchandise_subtotal": round(merch_subtotal, 2),
                    "Escrow_amount":        round(escrow, 2),
                    "Currency":             currency,
                    "Logistics_status":     logistics,
                    "Voucher_platform":     0.0,
                    "Voucher_seller":       round(voucher_seller, 2),
                    "Traffic_source":       traffic_source,
                    **meta,
                })
    return out
