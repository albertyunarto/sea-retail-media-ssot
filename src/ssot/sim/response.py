"""Ad-response primitives: geometric adstock + Hill saturation.

These are the two workhorse functions MMM tools (Meridian, Robyn) use to map
spend to incremental response. Keeping them here means the dashboard's "what
did the MMM recover vs ground truth" story is correct by construction.
"""

from __future__ import annotations

import numpy as np


def adstock_geometric(spend: np.ndarray, halflife_days: float) -> np.ndarray:
    """Apply geometric (infinite-memory) adstock with `halflife_days`.

    adstock[t] = spend[t] + decay * adstock[t-1]
    where decay = 0.5 ** (1 / halflife_days).

    Works on 1-D (time) arrays; for 2-D arrays, pass (markets, days) and
    loop — kept simple to make the math auditable.
    """
    if spend.ndim != 1:
        raise ValueError(f"adstock_geometric expects 1-D array, got shape {spend.shape}")
    if halflife_days <= 0:
        return spend.copy()
    decay = 0.5 ** (1.0 / halflife_days)
    out = np.empty_like(spend, dtype=float)
    prev = 0.0
    for i, s in enumerate(spend):
        prev = s + decay * prev
        out[i] = prev
    return out


def hill(x: np.ndarray, ec50: float, shape: float) -> np.ndarray:
    """Normalized Hill saturation: y = x^s / (x^s + ec50^s)  in [0, 1].

    At x = ec50, y = 0.5. Shape controls curvature (1 = gentle, 2+ = sharp
    knee). Returns the *normalized* response; caller multiplies by the
    channel's base_roas * spend (or equivalent revenue scale).
    """
    if ec50 <= 0:
        raise ValueError("ec50 must be > 0")
    x = np.asarray(x, dtype=float)
    x_clip = np.clip(x, a_min=0.0, a_max=None)
    xs = x_clip ** shape
    return xs / (xs + ec50 ** shape)


def calibrated_response(
    spend: np.ndarray,
    *,
    halflife_days: float,
    hill_shape: float,
    baseline_roas: float,
    daily_baseline_spend_sgd: float,
) -> np.ndarray:
    """Full channel response: adstock -> Hill -> scale to revenue.

    Calibrated so that at steady-state daily spend = `daily_baseline_spend_sgd`
    (no seasonality), the attributable revenue equals `baseline_roas *
    daily_baseline_spend_sgd`. Above baseline, saturation bites and marginal
    ROAS drops; below baseline, revenue falls sub-linearly.

    Implementation:
      - Geometric adstock with the given half-life.
      - ec50 anchored to the steady-state adstock of the baseline spend, so
        saturation = 0.5 at steady state regardless of shape.
      - Asymptote = 2 * baseline_roas * daily_baseline_spend_sgd (so that
        revenue at steady state = baseline_roas * baseline_spend).
    """
    if daily_baseline_spend_sgd <= 0:
        raise ValueError("daily_baseline_spend_sgd must be > 0")
    decay = 0.5 ** (1.0 / halflife_days) if halflife_days > 0 else 0.0
    steady_state_adstock = daily_baseline_spend_sgd / max(1e-9, 1.0 - decay)
    ec50 = steady_state_adstock
    carry = adstock_geometric(spend, halflife_days)
    saturation = hill(carry, ec50, hill_shape)
    asymptote = 2.0 * baseline_roas * daily_baseline_spend_sgd
    return saturation * asymptote
