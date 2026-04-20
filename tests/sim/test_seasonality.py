"""Seasonality overlay unit tests."""

from __future__ import annotations

from datetime import date

from ssot.sim.config import load_seasonality
from ssot.sim.seasonality import build_multiplier_map


def test_build_multiplier_map_covers_full_range():
    seas = load_seasonality()
    m = build_multiplier_map(seas, ["ID", "SG"], date(2026, 1, 1), date(2026, 1, 10))
    # 10 days × 2 markets = 20 entries
    assert len(m) == 20
    for key in m:
        assert key[0] in {"ID", "SG"}
        assert date(2026, 1, 1) <= key[1] <= date(2026, 1, 10)
        assert m[key] > 0


def test_ramadan_applies_to_id_my_only():
    seas = load_seasonality()
    # 2026-03-01 is mid-Ramadan per our seasonality.yaml
    d = date(2026, 3, 1)
    m = build_multiplier_map(seas, ["ID", "MY", "SG", "PH", "TH", "VN"],
                             d, d)
    id_mult = m[("ID", d)]
    my_mult = m[("MY", d)]
    sg_mult = m[("SG", d)]
    # ID and MY should be visibly elevated vs SG on this date.
    assert id_mult > sg_mult
    assert my_mult > sg_mult


def test_mega_sale_1111_applies_to_all_markets():
    seas = load_seasonality()
    d = date(2025, 11, 11)
    m = build_multiplier_map(seas, ["ID", "TH", "VN", "MY", "SG", "PH"], d, d)
    # All markets should be >= 2.5x baseline (11.11 peak = 3.8x times DoW).
    for mk in ["ID", "TH", "VN", "MY", "SG", "PH"]:
        assert m[(mk, d)] >= 2.5, f"{mk} has low 11.11 multiplier: {m[(mk, d)]}"


def test_payday_uplift_on_first_of_month():
    seas = load_seasonality()
    d = date(2026, 1, 15)  # payday, Thursday (not special)
    m = build_multiplier_map(seas, ["SG"], d, d)
    # Thursday multiplier ~ 0.95 * payday_uplift 1.25 => ~1.19
    assert m[("SG", d)] > 1.0


def test_post_lebaran_lull_reduces_demand_in_id_my():
    seas = load_seasonality()
    # 2026-03-25 is in the post-Lebaran lull per seasonality.yaml
    d = date(2026, 3, 25)
    m = build_multiplier_map(seas, ["ID", "SG"], d, d)
    assert m[("ID", d)] < m[("SG", d)]
