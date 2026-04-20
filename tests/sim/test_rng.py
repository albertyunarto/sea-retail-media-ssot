"""Determinism + independence of named substreams."""

from __future__ import annotations

import numpy as np

from ssot.sim.rng import make_rng


def test_same_seed_identical_draws():
    a = make_rng(42).normal(size=100)
    b = make_rng(42).normal(size=100)
    np.testing.assert_array_equal(a, b)


def test_different_seed_different_draws():
    a = make_rng(42).normal(size=100)
    b = make_rng(43).normal(size=100)
    assert not np.array_equal(a, b)


def test_spawn_labels_independent_of_each_other():
    """spawn('A') and spawn('B') on the same root seed produce different streams."""
    root = make_rng(42)
    a = root.spawn("A").normal(size=100)
    b = root.spawn("B").normal(size=100)
    assert not np.array_equal(a, b)


def test_spawn_same_label_identical():
    """Two spawns of the same label on the same root produce identical streams."""
    a = make_rng(42).spawn("channel:tiktok_ads").normal(size=100)
    b = make_rng(42).spawn("channel:tiktok_ads").normal(size=100)
    np.testing.assert_array_equal(a, b)


def test_spawn_order_does_not_affect_individual_streams():
    """Refactoring the call order of `.spawn()` must not perturb any stream."""
    root1 = make_rng(42)
    a1 = root1.spawn("spend").normal(size=50)
    b1 = root1.spawn("funnel").normal(size=50)

    root2 = make_rng(42)
    # Swap order
    b2 = root2.spawn("funnel").normal(size=50)
    a2 = root2.spawn("spend").normal(size=50)

    np.testing.assert_array_equal(a1, a2)
    np.testing.assert_array_equal(b1, b2)


def test_nested_spawn_also_deterministic():
    a = make_rng(42).spawn("channel:tiktok_ads").spawn("market:ID").normal(size=20)
    b = make_rng(42).spawn("channel:tiktok_ads").spawn("market:ID").normal(size=20)
    np.testing.assert_array_equal(a, b)
