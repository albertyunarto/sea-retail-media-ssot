"""Scenario overlay tests."""

from __future__ import annotations

from datetime import date

import pytest

from ssot.sim.config import load_sim_config
from ssot.sim.scenarios import apply, apply_by_name


def _cfg():
    return load_sim_config(
        seed=42,
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 10),
        markets=["ID"],
    )


def test_competitor_launch_reduces_roas_across_channels():
    cfg = _cfg()
    before = {k: v.baseline_roas for k, v in cfg.priors.channels.items()}
    after_cfg = apply_by_name(cfg, "competitor_launch")
    after = {k: v.baseline_roas for k, v in after_cfg.priors.channels.items()}
    # At least one channel must drop by the scenario's mul factor.
    assert after["tiktok_ads"] < before["tiktok_ads"]
    assert after["meta_cpas"] < before["meta_cpas"]


def test_scenario_apply_does_not_mutate_original():
    cfg = _cfg()
    original_roas = cfg.priors.channels["tiktok_ads"].baseline_roas
    _ = apply_by_name(cfg, "competitor_launch")
    # Original config unchanged.
    assert cfg.priors.channels["tiktok_ads"].baseline_roas == original_roas


def test_algo_change_reduces_tiktok_ctr_by_30pct():
    cfg = _cfg()
    before = cfg.priors.channels["tiktok_ads"].ctr
    after_cfg = apply_by_name(cfg, "algo_change")
    after = after_cfg.priors.channels["tiktok_ads"].ctr
    # Scenario multiplier is 0.7.
    assert abs(after - before * 0.7) < 1e-9


def test_supply_shortage_halves_organic_baselines():
    cfg = _cfg()
    before_sh = cfg.priors.organic["shopee"].baseline_daily_gmv_sgd
    before_tt = cfg.priors.organic["tiktok_shop"].baseline_daily_gmv_sgd
    after_cfg = apply_by_name(cfg, "supply_shortage")
    assert after_cfg.priors.organic["shopee"].baseline_daily_gmv_sgd == before_sh * 0.5
    assert after_cfg.priors.organic["tiktok_shop"].baseline_daily_gmv_sgd == before_tt * 0.5


def test_unknown_scenario_raises():
    cfg = _cfg()
    with pytest.raises(KeyError):
        apply_by_name(cfg, "not_a_scenario")


def test_ground_truth_emitter_writes_yaml(tmp_path):
    from ssot.sim.engine import simulate
    from ssot.sim.ground_truth import emit_ground_truth
    import yaml

    cfg = _cfg()
    latent = simulate(cfg)
    out = tmp_path / "mmm_ground_truth.yaml"
    emit_ground_truth(latent, out)
    assert out.exists()
    loaded = yaml.safe_load(out.read_text())
    assert "channels" in loaded
    # Each paid channel in priors should appear in ground_truth.
    for ch in cfg.priors.channels:
        assert ch in loaded["channels"], f"missing {ch} in ground_truth"
        gt = loaded["channels"][ch]
        assert "baseline_roas" in gt
        assert "adstock_halflife_days" in gt
