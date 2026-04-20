import { C, FONT, CHANNEL_COLOR } from "@/lib/tokens";
import { fmtDelta, fmtUSD } from "@/lib/format";
import { Sparkline } from "./sparkline";

export interface SmCell {
  values: number[];
  delta: number | null;
  now: number;
}

export function SmallMultiples({
  rows,
  cols,
  cells,
  cellH = 36,
  valueLabel = (v: number) => fmtUSD(v),
}: {
  rows: { id: string; label: string }[];
  cols: { id: string; label: string }[];
  cells: Record<string, SmCell>;
  cellH?: number;
  valueLabel?: (v: number) => string;
}) {
  return (
    <div
      style={{
        overflow: "auto",
        border: `1px solid ${C.rule}`,
        background: C.paper,
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          fontFamily: FONT.mono,
          fontSize: 11,
        }}
      >
        <thead>
          <tr style={{ background: C.paper2 }}>
            <th
              style={{
                padding: "8px 10px",
                textAlign: "left",
                borderBottom: `1px solid ${C.rule}`,
                fontSize: 9,
                color: C.ink3,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                position: "sticky",
                left: 0,
                background: C.paper2,
                zIndex: 1,
              }}
            >
              Channel
            </th>
            {cols.map((c) => (
              <th
                key={c.id}
                style={{
                  padding: "8px 10px",
                  borderBottom: `1px solid ${C.rule}`,
                  borderLeft: `1px solid ${C.ruleSoft}`,
                  fontSize: 9,
                  color: C.ink2,
                  letterSpacing: "0.08em",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.id}
              style={{
                borderBottom: i < rows.length - 1 ? `1px solid ${C.ruleSoft}` : "none",
              }}
            >
              <td
                style={{
                  padding: "6px 10px",
                  color: C.ink,
                  position: "sticky",
                  left: 0,
                  background: C.paper,
                  zIndex: 1,
                  borderRight: `1px solid ${C.ruleSoft}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      background: CHANNEL_COLOR[r.id] ?? C.ink,
                    }}
                  />
                  <span>{r.label}</span>
                </div>
              </td>
              {cols.map((c) => {
                const cell = cells[`${r.id}|${c.id}`];
                if (!cell || cell.now < 1) {
                  return (
                    <td
                      key={c.id}
                      style={{
                        padding: "6px 8px",
                        borderLeft: `1px solid ${C.ruleSoft}`,
                        color: C.ink4,
                        textAlign: "center",
                      }}
                    >
                      —
                    </td>
                  );
                }
                const positive = cell.delta != null && cell.delta >= 0;
                return (
                  <td
                    key={c.id}
                    style={{
                      padding: "4px 6px",
                      borderLeft: `1px solid ${C.ruleSoft}`,
                      verticalAlign: "middle",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkline
                        values={cell.values}
                        color={CHANNEL_COLOR[r.id] ?? C.ink}
                        width={56}
                        height={cellH * 0.5}
                        fill
                      />
                      <div style={{ minWidth: 0, lineHeight: 1.1 }}>
                        <div
                          style={{
                            fontSize: 10,
                            fontVariantNumeric: "tabular-nums",
                            color: C.ink,
                          }}
                        >
                          {valueLabel(cell.now)}
                        </div>
                        {cell.delta != null && (
                          <div
                            style={{
                              fontSize: 9,
                              color: positive ? C.moss : C.accent,
                              fontWeight: 600,
                            }}
                          >
                            {fmtDelta(cell.delta, 0)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
