"""Emit a YAML snapshot of the engine's 'ground truth' priors.

Meridian / Robyn and other MMM tools try to *recover* these values from
observed spend and revenue; shipping the true values alongside the generated
data enables the demo narrative "here's what the MMM recovered vs ground
truth" (PRD-A Should-Have #4).
"""

from __future__ import annotations

from pathlib import Path

import yaml

from .engine import LatentState


def emit_ground_truth(latent: LatentState, output_path: Path) -> None:
    """Write `latent.ground_truth` plus run-level metadata to YAML."""
    payload = {
        "generated_by": "ssot.sim",
        "note": "These are the TRUE values used by the engine. Any MMM tool "
                "applied to the generated data should recover values close "
                "to these (within noise).",
        "channels": latent.ground_truth,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w") as f:
        yaml.safe_dump(payload, f, sort_keys=False)
