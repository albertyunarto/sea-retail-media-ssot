"""Scenario overlays — apply ConfigPatch lists to an in-memory SimConfig.

Path format is dotted, e.g. `priors.channels.tiktok_ads.baseline_roas`.
Supports `set` (replace), `mul` (multiply by), `add` (add to). Patches return
a *new* SimConfig (Pydantic model_copy) rather than mutating the original.
"""

from __future__ import annotations

from typing import Any

from .config import ConfigPatch, Scenario, SimConfig


def _get_nested(obj: Any, path: list[str]) -> Any:
    for key in path:
        if isinstance(obj, dict):
            obj = obj[key]
        else:
            obj = getattr(obj, key)
    return obj


def _set_nested(obj: Any, path: list[str], value: Any) -> None:
    for key in path[:-1]:
        if isinstance(obj, dict):
            obj = obj[key]
        else:
            obj = getattr(obj, key)
    last = path[-1]
    if isinstance(obj, dict):
        obj[last] = value
    else:
        setattr(obj, last, value)


def _apply_patch(cfg: SimConfig, patch: ConfigPatch) -> None:
    parts = patch.path.split(".")
    current = _get_nested(cfg, parts)
    if patch.op == "set":
        new = patch.value
    elif patch.op == "mul":
        new = current * float(patch.value)  # type: ignore[operator]
    elif patch.op == "add":
        new = current + float(patch.value)  # type: ignore[operator]
    else:
        raise ValueError(f"unknown op: {patch.op}")
    _set_nested(cfg, parts, new)


def apply(cfg: SimConfig, scenario: Scenario) -> SimConfig:
    """Return a new SimConfig with the scenario's patches applied."""
    new_cfg = cfg.model_copy(deep=True)
    for patch in scenario.patches:
        _apply_patch(new_cfg, patch)
    return new_cfg


def apply_by_name(cfg: SimConfig, name: str) -> SimConfig:
    scenario = cfg.scenarios.scenarios.get(name)
    if not scenario:
        raise KeyError(f"unknown scenario: {name} (available: {list(cfg.scenarios.scenarios.keys())})")
    return apply(cfg, scenario)
