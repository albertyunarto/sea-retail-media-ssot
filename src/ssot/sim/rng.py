"""Seedable RNG factory with named substreams.

Design goal: refactoring the engine's call order must not perturb unrelated
draws. Every distinct source of randomness (spend, funnel, noise, evc, …)
asks for a *named* substream, which is built from the root seed plus a hash
of the label. That way, reordering `draw_spend()` and `draw_funnel()` does
not change the numbers either emits.

The wrapper exposes a small, deliberately narrow API (normal, lognormal,
binomial, negative_binomial, dirichlet, uniform, choice) so tests can
monkey-patch or record/replay if we ever need to.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

import numpy as np


_MAX_JUMP = 2**62  # np.random.PCG64.jumped accepts any non-negative int


def _label_to_int(label: str) -> int:
    """Stable hash of a label to a large positive int for `.jumped(jumps=...)`."""
    digest = hashlib.blake2b(label.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big") % _MAX_JUMP


@dataclass
class Rng:
    """Thin NumPy Generator wrapper with `.spawn(label)` substreams."""

    root_seed: int
    label: str = "__root__"
    _gen: np.random.Generator | None = None

    def __post_init__(self) -> None:
        bit_gen = np.random.PCG64(self.root_seed)
        if self.label != "__root__":
            bit_gen = bit_gen.jumped(_label_to_int(self.label))
        self._gen = np.random.Generator(bit_gen)

    # -- substream factory -----------------------------------------------
    def spawn(self, label: str) -> "Rng":
        """Return a new Rng whose stream is seeded from (root_seed, label)."""
        return Rng(root_seed=self.root_seed, label=f"{self.label}/{label}")

    # -- narrow distribution API -----------------------------------------
    @property
    def gen(self) -> np.random.Generator:
        assert self._gen is not None
        return self._gen

    def normal(self, loc: float = 0.0, scale: float = 1.0, size=None) -> np.ndarray:
        return self.gen.normal(loc, scale, size)

    def lognormal(self, mean: float = 0.0, sigma: float = 1.0, size=None) -> np.ndarray:
        return self.gen.lognormal(mean, sigma, size)

    def binomial(self, n, p, size=None) -> np.ndarray:
        return self.gen.binomial(n, p, size)

    def negative_binomial(self, n, p, size=None) -> np.ndarray:
        return self.gen.negative_binomial(n, p, size)

    def uniform(self, low=0.0, high=1.0, size=None) -> np.ndarray:
        return self.gen.uniform(low, high, size)

    def dirichlet(self, alpha, size=None) -> np.ndarray:
        return self.gen.dirichlet(alpha, size)

    def choice(self, a, size=None, replace=True, p=None) -> np.ndarray:
        return self.gen.choice(a, size=size, replace=replace, p=p)


def make_rng(seed: int) -> Rng:
    return Rng(root_seed=seed)
