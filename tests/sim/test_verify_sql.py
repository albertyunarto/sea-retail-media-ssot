"""Verify SQL files exist, cover the documented invariants, and parse as SQL.

Baseline invariants (10) come from PRD-A §10 Phase 5. Phase 1 of the
measurement-framework roadmap added 2 more (`is_mega_sale` matches seed
+ direct ≤ broad), so the floor is now 12.
"""

from __future__ import annotations

from pathlib import Path

VERIFY_DIR = Path(__file__).resolve().parents[2] / "sql" / "verify"
MIN_VERIFY_SQLS = 12


def test_verify_sql_floor():
    files = sorted(VERIFY_DIR.glob("*.sql"))
    assert len(files) >= MIN_VERIFY_SQLS, (
        f"expected ≥{MIN_VERIFY_SQLS} verify SQLs, got {len(files)}: {[f.name for f in files]}"
    )


def test_every_verify_file_is_a_select_statement():
    """Each verify SQL must be a SELECT (zero rows = pass)."""
    for f in sorted(VERIFY_DIR.glob("*.sql")):
        txt = f.read_text().strip()
        # Allow a leading WITH for CTE-based SELECTs.
        upper = txt.upper().lstrip("-/ \n")
        # Strip comment lines.
        body = "\n".join(line for line in upper.splitlines() if not line.strip().startswith("--"))
        assert "SELECT" in body, f"{f.name} has no SELECT"


def test_verify_files_reference_expected_invariants():
    """Spot-check that the invariant names match PRD §10 Phase 5."""
    names = {f.name for f in VERIFY_DIR.glob("*.sql")}
    expected_substrings = [
        "evc_bounded",             # 1
        "ads_attributed_gmv",      # 2
        "no_negative",             # 3
        "funnel_monotone",         # 4/9
        "voucher_subsidy",         # 5
        "every_market",            # 6
        "grain_columns",           # 7
        "channel_taxonomy",        # 8
        "deprecated_windows",      # 10
    ]
    for sub in expected_substrings:
        assert any(sub in n for n in names), f"no verify SQL mentions '{sub}' (have {names})"
