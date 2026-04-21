import { C, FONT } from "@/lib/tokens";
import { fmtPct } from "@/lib/format";

/**
 * Paired horizontal bars for share-of-spend vs share-of-GMV per channel.
 * A divergence badge fires when |spend_share − gmv_share| > 0.05 —
 * the saturation / reallocation signal from Charter §4.2.
 */
export interface ShareRow {
  id: string;
  label: string;
  color: string;
  spendShare: number; // 0..1
  gmvShare: number; // 0..1
}

export function ShareComparison({
  rows,
  divergenceThreshold = 0.05,
}: {
  rows: ShareRow[];
  divergenceThreshold?: number;
}) {
  if (rows.length === 0) return null;
  return (
    <div
      style={{
        border: `1px solid ${C.rule}`,
        background: C.paper,
        fontFamily: FONT.mono,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(160px, 1.4fr) 1fr 1fr 90px",
          padding: "8px 14px",
          fontSize: 9,
          color: C.ink3,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          fontWeight: 600,
          borderBottom: `1px solid ${C.rule}`,
          background: C.paper2,
        }}
      >
        <span>Channel</span>
        <span>Share of spend</span>
        <span>Share of GMV</span>
        <span style={{ textAlign: "right" }}>Diverg.</span>
      </div>
      {rows.map((r, i) => {
        const diff = r.spendShare - r.gmvShare;
        const isDiverg = Math.abs(diff) > divergenceThreshold;
        // Over-spend (spend share > GMV share) is the classic saturation signal.
        const signalColor = diff > 0 ? C.accent : C.moss;
        return (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(160px, 1.4fr) 1fr 1fr 90px",
              padding: "10px 14px",
              alignItems: "center",
              fontSize: 11,
              borderBottom: i < rows.length - 1 ? `1px solid ${C.ruleSoft}` : "none",
              background: isDiverg ? "rgba(37,99,235,0.04)" : "transparent",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: C.ink,
                fontWeight: 500,
              }}
            >
              <span style={{ width: 10, height: 10, background: r.color, flexShrink: 0 }} />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.label}
              </span>
            </span>
            <Bar value={r.spendShare} color={r.color} />
            <Bar value={r.gmvShare} color={C.ink2} />
            <span
              style={{
                textAlign: "right",
                color: isDiverg ? signalColor : C.ink3,
                fontWeight: isDiverg ? 700 : 500,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.04em",
              }}
            >
              {isDiverg ? (
                <>
                  {diff > 0 ? "+" : "−"}
                  {fmtPct(Math.abs(diff), 1)}
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
        );
      })}
      <div
        style={{
          padding: "8px 14px",
          fontSize: 9,
          color: C.ink3,
          letterSpacing: "0.06em",
          borderTop: `1px solid ${C.ruleSoft}`,
          background: C.paper2,
        }}
      >
        Divergence fires when |spend share − GMV share| &gt;{" "}
        <strong style={{ color: C.ink2 }}>
          {fmtPct(divergenceThreshold, 1)}
        </strong>
        . Positive (blue) = over-spending vs return (saturation candidate). Negative
        (green) = under-funded for its yield (scaling candidate).
      </div>
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 8,
          background: C.paper2,
          position: "relative",
          maxWidth: 180,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct * 100}%`,
            background: color,
            opacity: 0.9,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color: C.ink,
          fontVariantNumeric: "tabular-nums",
          minWidth: 44,
          textAlign: "right",
        }}
      >
        {fmtPct(value, 1)}
      </span>
    </div>
  );
}
