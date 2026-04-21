import { C, FONT } from "@/lib/tokens";
import { fmtUSD } from "@/lib/format";

/**
 * Dual-axis chart — platform GMV as a line on the left axis, spend
 * stacked by channel as columns on the right axis. Shared X axis of
 * daily dates. Mega-sale + payday markers render as dashed vertical
 * rules for the Charter §4.4 overlay.
 */
export interface DualAxisProps {
  height?: number;
  xLabels: string[];
  /** GMV series on the left axis. */
  gmv: number[];
  /** Stacked spend columns on the right axis — one entry per day, per channel. */
  spendStack: { label: string; color: string; values: number[] }[];
  /** Indices into xLabels that should draw a dashed vertical overlay. */
  paydayIndices?: number[];
  megaSaleIndices?: { index: number; label: string }[];
}

export function DualAxis({
  height = 280,
  xLabels,
  gmv,
  spendStack,
  paydayIndices = [],
  megaSaleIndices = [],
}: DualAxisProps) {
  const W = 800;
  const H = height;
  const padL = 56;
  const padR = 56;
  const padT = 30;
  const padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxGmv = Math.max(...gmv, 1);
  const spendTotals = spendStack[0]
    ? spendStack[0].values.map((_, i) =>
        spendStack.reduce((a, s) => a + (s.values[i] ?? 0), 0),
      )
    : [];
  const maxSpend = Math.max(...spendTotals, 1);

  const xStep = innerW / Math.max(xLabels.length - 1, 1);
  const xPx = (i: number) => padL + i * xStep;
  const barW = (innerW / Math.max(xLabels.length, 1)) * 0.55;
  const yGmv = (v: number) => padT + innerH - (v / maxGmv) * innerH;
  const ySpend = (v: number) => padT + innerH - (v / maxSpend) * innerH;

  const gmvPath = gmv
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xPx(i).toFixed(2)} ${yGmv(v).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: H, display: "block" }}
    >
      {/* Horizontal grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const y = padT + innerH * p;
        return (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              stroke={i === 4 ? C.rule : C.ruleSoft}
              strokeWidth={i === 4 ? 1 : 0.5}
            />
            {/* Left axis — GMV */}
            <text
              x={padL - 8}
              y={y + 3}
              fontSize="9"
              fill={C.ink3}
              textAnchor="end"
              fontFamily={FONT.mono}
            >
              {fmtUSD(maxGmv * (1 - p))}
            </text>
            {/* Right axis — Spend */}
            <text
              x={W - padR + 8}
              y={y + 3}
              fontSize="9"
              fill={C.accent}
              textAnchor="start"
              fontFamily={FONT.mono}
            >
              {fmtUSD(maxSpend * (1 - p))}
            </text>
          </g>
        );
      })}

      {/* Promo overlays — under the bars */}
      {paydayIndices.map((i) => (
        <line
          key={`payday-${i}`}
          x1={xPx(i)}
          x2={xPx(i)}
          y1={padT}
          y2={H - padB}
          stroke={C.gold}
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.55"
        />
      ))}
      {megaSaleIndices.map(({ index, label }) => (
        <g key={`mega-${index}`}>
          <line
            x1={xPx(index)}
            x2={xPx(index)}
            y1={padT}
            y2={H - padB}
            stroke={C.accent}
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.8"
          />
          <text
            x={xPx(index)}
            y={padT - 12}
            fontSize="9"
            fill={C.accent}
            textAnchor="middle"
            fontFamily={FONT.mono}
            fontWeight="700"
            letterSpacing="0.06em"
          >
            {label.toUpperCase()}
          </text>
        </g>
      ))}

      {/* Spend stacked columns */}
      {xLabels.map((_, i) => {
        let acc = 0;
        const x = xPx(i) - barW / 2;
        return (
          <g key={`bar-${i}`}>
            {spendStack.map((s, j) => {
              const v = s.values[i] ?? 0;
              const h = ySpend(0) - ySpend(v);
              const y = ySpend(acc + v);
              acc += v;
              return (
                <rect key={j} x={x} y={y} width={barW} height={h} fill={s.color} opacity={0.85} />
              );
            })}
          </g>
        );
      })}

      {/* GMV line on top */}
      <path d={gmvPath} stroke={C.ink} strokeWidth="2" fill="none" />
      {gmv.map((v, i) => (
        <circle key={`pt-${i}`} cx={xPx(i)} cy={yGmv(v)} r="2" fill={C.ink} />
      ))}

      {/* X labels — every ~7th tick */}
      {xLabels.map((lbl, i) => {
        if (i % Math.ceil(xLabels.length / 7) !== 0) return null;
        return (
          <text
            key={`xl-${i}`}
            x={xPx(i)}
            y={H - 10}
            fontSize="9"
            fill={C.ink3}
            textAnchor="middle"
            fontFamily={FONT.mono}
          >
            {lbl}
          </text>
        );
      })}

      {/* Axis legends */}
      <text
        x={padL - 8}
        y={padT - 10}
        fontSize="9"
        fill={C.ink}
        fontFamily={FONT.mono}
        fontWeight="700"
        textAnchor="end"
        letterSpacing="0.08em"
      >
        GMV →
      </text>
      <text
        x={W - padR + 8}
        y={padT - 10}
        fontSize="9"
        fill={C.accent}
        fontFamily={FONT.mono}
        fontWeight="700"
        letterSpacing="0.08em"
      >
        ← SPEND
      </text>
    </svg>
  );
}
