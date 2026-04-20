"""TikTok Shop — order-line rows (one row per Order_id × Sku_id).

Raw table: ${RAW_DATASET}.tiktok_shop_orders (sql/ddl/01_raw_tiktok_shop_orders.sql)

Grain: one row per order line. For each (market, date) we take the TikTok
Shop organic platform orders + TikTok Ads attributed orders, fan out into
individual orders, and assign traffic source from the TikTok Shop canonical
distribution (LIVE / VIDEO / PRODUCT_CARD / SEARCH / MALL / AFFILIATE —
matches seed_traffic_source).
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

import numpy as np

from ..allocators import TIKTOK_SHOP_TRAFFIC_WEIGHTS
from ..config import SimConfig
from ..engine import LatentState
from ..rng import Rng
from .base import account_id_for, metadata, sgd_to_local, MARKET_CURRENCY

SOURCE = "tiktok_shop"


def project(latent: LatentState, cfg: SimConfig, rng: Rng) -> list[dict]:
    organic = latent.organic[latent.organic["anchor_platform"] == "tiktok_shop"].reset_index(drop=True)
    if organic.empty:
        return []

    ads = latent.panel[latent.panel["anchor_platform"] == "tiktok_shop"].copy()
    ads_orders = (ads.groupby(["market", "date_local"], as_index=False)
                  ["ads_attributed_orders"].sum()
                  .rename(columns={"ads_attributed_orders": "ads_orders"}))
    plat = organic.merge(ads_orders, on=["market", "date_local"], how="left")
    plat["ads_orders"] = plat["ads_orders"].fillna(0).astype(int)
    plat["total_orders"] = plat["platform_total_orders"].astype(int) + plat["ads_orders"]

    sub_rng = rng.spawn(SOURCE)
    traffic_names = list(TIKTOK_SHOP_TRAFFIC_WEIGHTS.keys())
    traffic_w = np.array(list(TIKTOK_SHOP_TRAFFIC_WEIGHTS.values()), dtype=float)
    traffic_w = traffic_w / traffic_w.sum()

    # Pre-compute SKU weighting (category-share flat within category).
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

        # ONE spawn per (market, date). Bulk all draws with gen.uniform.
        gen = sub_rng.spawn(f"{mk}:{d}").gen
        u_lines = gen.uniform(size=n_orders)
        u_traffic = gen.uniform(size=n_orders)
        secs = gen.uniform(0, 86400, size=n_orders).astype(np.int64)
        u_status = gen.uniform(size=n_orders)
        # Up to 2 lines per order; preallocate max-size buffers.
        u_sku = gen.uniform(size=n_orders * 2)
        u_qty = gen.uniform(size=n_orders * 2)

        lines_per_order = np.where(u_lines < 0.12, 2, 1)
        traffic_idx = np.searchsorted(np.cumsum(traffic_w), u_traffic)
        sku_idx_all = np.searchsorted(sku_cdf, u_sku)
        day_start = datetime.combine(d, time.min, tzinfo=timezone.utc)

        line_cursor = 0
        for o_idx in range(n_orders):
            ts = day_start + timedelta(seconds=int(secs[o_idx]))
            ts_iso = ts.isoformat()
            if u_status[o_idx] < 0.94:
                status, pay_iso = "completed", ts_iso
            elif u_status[o_idx] < 0.97:
                status, pay_iso = "cancelled", None
            else:
                status, pay_iso = "pending", None
            traffic_source = traffic_names[int(traffic_idx[o_idx])]

            n_lines = int(lines_per_order[o_idx])
            order_id = f"tts-{mk}-{date_prefix}-{o_idx:05d}"
            for line_idx in range(n_lines):
                c = line_cursor
                line_cursor += 1
                sku = all_skus[int(sku_idx_all[c])]
                qty = 1 if u_qty[c] >= 0.15 else 2

                # Cache per-SKU local prices (stable per market).
                cache_key = (mk, int(sku_idx_all[c]))
                unit_local = sku_price_local_cache.get(cache_key)
                if unit_local is None:
                    unit_local = sgd_to_local(mk, sku.unit_price_sgd)
                    sku_price_local_cache[cache_key] = unit_local

                sub_total = unit_local * qty
                shipping = 2.0 * sgd_to_local(mk, 1.0)
                order_amount = sub_total + shipping
                out.append({
                    "Date":                 date_str,
                    "Order_id":             order_id,
                    "Order_status":         status,
                    "Order_create_time":    ts_iso,
                    "Payment_time":         pay_iso,
                    "Buyer_country":        mk,
                    "Shop_id":              shop_id,
                    "Sku_id":               sku.sku_id,
                    "Product_id":           sku.sku_id + "_prod",
                    "Quantity":             qty,
                    "Original_price":       round(unit_local, 2),
                    "Sub_total":            round(sub_total, 2),
                    "Order_amount":         round(order_amount, 2),
                    "Currency":             currency,
                    "Shipping_fee":         round(shipping, 2),
                    "Order_source":         traffic_source,
                    "Affiliate_creator_id": f"creator_{mk.lower()}_{o_idx % 200:04d}" if traffic_source == "AFFILIATE" else None,
                    **meta,
                })
    return out
