"""Adstock geometric decay + Hill saturation unit tests."""

from __future__ import annotations

import numpy as np

from ssot.sim.response import adstock_geometric, calibrated_response, hill


def test_adstock_impulse_decays_by_half_at_halflife():
    # Impulse at t=0, halflife=5 => value at t=5 ~ 0.5.
    spend = np.zeros(20)
    spend[0] = 100.0
    out = adstock_geometric(spend, halflife_days=5.0)
    assert out[0] == 100.0
    # After exactly halflife steps, residual ~ 0.5 * impulse.
    assert abs(out[5] - 50.0) < 1.0
    # Monotone non-increasing after impulse.
    assert all(out[i] >= out[i + 1] for i in range(1, 19))


def test_adstock_halflife_zero_is_passthrough():
    spend = np.array([1.0, 2.0, 3.0, 4.0])
    np.testing.assert_array_equal(adstock_geometric(spend, halflife_days=0.0), spend)


def test_hill_at_ec50_is_half():
    # y(ec50) = 0.5 regardless of shape.
    for shape in (1.0, 1.5, 2.0, 2.5):
        y = hill(np.array([500.0]), ec50=500.0, shape=shape)
        assert abs(y[0] - 0.5) < 1e-9


def test_hill_monotone_increasing():
    x = np.linspace(0, 5000, 50)
    y = hill(x, ec50=1000.0, shape=1.8)
    assert all(y[i] <= y[i + 1] + 1e-9 for i in range(49))
    assert y[0] == 0.0
    assert y[-1] < 1.0
    assert y[-1] > 0.9  # approaching asymptote


def test_hill_saturates():
    # At 100x ec50, response should be near 1.
    y = hill(np.array([100_000.0]), ec50=1000.0, shape=2.0)
    assert y[0] > 0.999


def test_calibrated_response_monotone_in_spend():
    spend = np.linspace(0, 3000, 60)
    rev = calibrated_response(
        spend,
        halflife_days=3.0,
        hill_shape=1.8,
        baseline_roas=5.0,
        daily_baseline_spend_sgd=500.0,
    )
    # Monotone non-decreasing day-over-day for monotone spend (adstock carries forward).
    assert all(rev[i] <= rev[i + 1] + 1e-9 for i in range(59))


def test_calibrated_response_zero_spend_is_zero():
    rev = calibrated_response(
        np.zeros(10),
        halflife_days=3.0,
        hill_shape=1.8,
        baseline_roas=5.0,
        daily_baseline_spend_sgd=500.0,
    )
    np.testing.assert_array_equal(rev, np.zeros(10))


def test_calibrated_response_steady_state_roas_matches_baseline():
    """If we hold spend flat at the baseline, long-run daily ROAS ~= baseline_roas."""
    baseline = 500.0
    spend = np.full(120, baseline)
    rev = calibrated_response(
        spend,
        halflife_days=3.0,
        hill_shape=1.8,
        baseline_roas=5.0,
        daily_baseline_spend_sgd=baseline,
    )
    # Exclude the ramp-up days; take steady-state tail.
    steady = rev[-30:]
    daily_roas = steady / baseline
    # Should converge to ~5.0 (within 5%).
    assert abs(daily_roas.mean() - 5.0) < 0.25
