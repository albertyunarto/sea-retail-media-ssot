import { C, FONT } from "@/lib/tokens";
import { fmtUSD } from "@/lib/format";

export interface Lever {
  name: string;
  prevValue: string;
  nowValue: string;
  contribution: number; // signed USD delta
}

export function LeverBridge({ levers = [] }: { levers: Lever[] }) {
  const maxAbs = Math.max(...levers.map((l) => Math.abs(l.contribution)), 1);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        border: `1px solid ${C.rule}`,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1.6fr 0.8fr",
          background: C.paper2,
          fontFamily: FONT.mono,
          fontSize: 9,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: C.ink3,
          padding: "6px 12px",
          borderBottom: `1px solid ${C.rule}`,
          fontWeight: 600,
        }}
      >
        <span>Lever</span>
        <span style={{ textAlign: "right" }}>Prior</span>
        <span style={{ textAlign: "right" }}>Now</span>
        <span>Contribution to GMV Δ</span>
        <span style={{ textAlign: "right" }}>Δ</span>
      </div>
      {levers.map((l, i) => {
        const dir = l.contribution >= 0;
        const w = (Math.abs(l.contribution) / maxAbs) * 100;
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1.6fr 0.8fr",
              padding: "10px 12px",
              borderBottom: i < levers.length - 1 ? `1px solid ${C.ruleSoft}` : "none",
              alignItems: "center",
              fontFamily: FONT.mono,
              fontSize: 12,
            }}
          >
            <span style={{ color: C.ink, fontWeight: 600 }}>{l.name}</span>
            <span
              style={{
                textAlign: "right",
                color: C.ink2,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {l.prevValue}
            </span>
            <span
              style={{
                textAlign: "right",
                color: C.ink,
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
              }}
            >
              {l.nowValue}
            </span>
            <div
              style={{
                position: "relative",
                height: 18,
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: C.ink3,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  bottom: 3,
                  left: dir ? "50%" : `calc(50% - ${w / 2}%)`,
                  width: `${w / 2}%`,
                  background: dir ? C.moss : C.accent,
                }}
              />
            </div>
            <span
              style={{
                textAlign: "right",
                fontWeight: 700,
                color: dir ? C.moss : C.accent,
              }}
            >
              {(dir ? "+" : "−") + fmtUSD(Math.abs(l.contribution))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
