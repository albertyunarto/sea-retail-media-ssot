"""Noise helpers: log-normal for continuous values, negative-binomial for counts.

Both preserve the input's expected value while adding realistic jitter:
- log-normal with sigma=noise_coef for GMV / spend / value columns
- neg-binomial parameterised by mean = value, variance = value * (1 + overdispersion)
  for impression / click / order counts

All helpers are pure functions taking an Rng; no hidden state.
"""

from __future__ import annotations

import numpy as np

from .rng import Rng


def jitter_value(rng: Rng, values: np.ndarray, noise_coef: float) -> np.ndarray:
    """Multiply each value by lognormal(mu=-sigma^2/2, sigma=noise_coef).

    The mu offset keeps E[lognormal] = 1, so the expected value is preserved.
    """
    if noise_coef <= 0:
        return values.astype(float)
    sigma = float(noise_coef)
    mu = -0.5 * sigma * sigma
    mult = rng.lognormal(mean=mu, sigma=sigma, size=values.shape)
    return values * mult


def jitter_count(rng: Rng, mean: np.ndarray, overdispersion: float) -> np.ndarray:
    """Draw counts from a negative-binomial with the given mean and overdispersion.

    Variance = mean * (1 + mean * overdispersion). At overdispersion=0 this
    degenerates to Poisson (we fall back explicitly to avoid numerical issues).
    """
    mean_arr = np.asarray(mean, dtype=float)
    mean_arr = np.clip(mean_arr, a_min=0.0, a_max=None)
    if overdispersion <= 0:
        return rng.gen.poisson(mean_arr).astype(np.int64)

    # NumPy's negative_binomial uses (n, p) with mean = n*(1-p)/p.
    # Set p = 1 / (1 + mean * overdispersion), n = mean * p / (1 - p).
    # When mean is 0, just return 0 — NB can't be parameterised with mean=0.
    p = 1.0 / (1.0 + mean_arr * overdispersion)
    safe = mean_arr > 0
    out = np.zeros_like(mean_arr, dtype=np.int64)
    if np.any(safe):
        mean_safe = mean_arr[safe]
        p_safe = p[safe]
        # n = mean * p / (1 - p); when p ~ 1 (overdispersion ~ 0) n gets huge — that's fine.
        n_safe = mean_safe * p_safe / (1.0 - p_safe)
        draws = rng.negative_binomial(n_safe, p_safe)
        out[safe] = draws.astype(np.int64)
    return out
