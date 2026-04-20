"""Cross-channel simulation data generator.

Produces internally-consistent, seed-reproducible, Supermetrics-shaped and
direct-to-BigQuery demo data for the SSOT pipeline. See PRD-A.

Public entry points:
  - ssot.sim.config.load_sim_config(...)   -> SimConfig
  - ssot.sim.engine.simulate(cfg)          -> LatentState
  - ssot.sim.cli.cli                       -> the `gen-data` Click group
"""

from __future__ import annotations

__all__ = ["config", "engine", "cli"]
