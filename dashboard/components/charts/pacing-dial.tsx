import { C, FONT } from "@/lib/tokens";
import { fmtDelta, fmtPct, fmtUSD } from "@/lib/format";

export function PacingDial({
  label,
  actual,
  plan,
  forecast,
  format = fmtUSD,
  daysLeft = 0,
}: {
  label: string;
  actual: number;
  plan: number;
  forecast: number;
  format?: (n: number) => string;
  daysLeft?: number;
}) {
  const planPct = plan > 0 ? actual / plan : 0;
  const forecastPct = plan > 0 ? forecast / plan : 0;
  const status = forecastPct < 0.95 ? "behind" : forecastPct > 1.05 ? "over" : "on";
  const statusColor = status === "on" ? C.moss : status === "behind" ? C.accent : C.gold;
  const W = 320;
  const padL = 8;
  const padR = 8;
  const innerW = W - padL - padR;

  const xActual = padL + Math.min(planPct, 1.2) * innerW * (1 / 1.2);
  const xForecast = padL + Math.min(forecastPct, 1.2) * innerW * (1 / 1.2);
  const xPlan = padL + (1 / 1.2) * innerW;

  return (
    <div
      style={{
        padding: "10px 14px",
        borderRight: `1px solid ${C.rule}`,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            color: C.ink3,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            color: statusColor,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          {status === "on" ? "● ON PACE" : status === "behind" ? "● BEHIND" : "● OVER"}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: FONT.serif,
            fontSize: 28,
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
          }}
        >
          {format(actual)}
        </span>
        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.ink3 }}>
          / {format(plan)} plan
        </span>
      </div>
      <svg viewBox={`0 0 ${W} 50`} width="100%" height={50} style={{ display: "block" }}>
        <rect x={padL} y={6} width={innerW} height={6} fill={C.paper2} />
        <line x1={xPlan} x2={xPlan} y1={2} y2={16} stroke={C.ink} strokeWidth="1.25" />
        <text
          x={xPlan}
          y={28}
          fontSize="8.5"
          fill={C.ink3}
          textAnchor="middle"
          fontFamily={FONT.mono}
        >
          100%
        </text>
        <rect
          x={padL}
          y={6}
          width={Math.max(xForecast - padL, 0)}
          height={6}
          fill={statusColor}
          opacity={0.35}
        />
        <rect
          x={padL}
          y={6}
          width={Math.max(xActual - padL, 0)}
          height={6}
          fill={statusColor}
        />
        <line
          x1={xForecast}
          x2={xForecast}
          y1={2}
          y2={16}
          stroke={statusColor}
          strokeWidth="1.25"
          strokeDasharray="2 2"
        />
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: FONT.mono,
          fontSize: 9.5,
          color: C.ink3,
          marginTop: 2,
        }}
      >
        <span>
          {fmtPct(planPct, 0)} of plan · day {30 - daysLeft}/30
        </span>
        <span>
          fcst {format(forecast)} ({fmtDelta((forecast - plan) / plan, 1)})
        </span>
      </div>
    </div>
  );
}
