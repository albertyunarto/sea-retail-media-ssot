"""Writer protocol."""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class Writer(Protocol):
    def write_source(self, source_name: str, rows: list[dict]) -> int:
        """Persist all rows for a given source (all markets/dates in one call).

        Returns the number of rows persisted.
        """
        ...
