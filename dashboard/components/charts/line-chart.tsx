import { C, FONT } from "@/lib/tokens";
import { fmtUSD } from "@/lib/format";

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
  weight?: number;
  dashed?: boolean;
}

export function LineChart({
  height = 240,
  series = [],
  xLabels = [],
}: {
  height?: number;
  series?: LineSeries[];
  xLabels?: string[];
}) {
  const W = 800,
    H = height;
  const padL = 48,
    padR = 8,
    padT = 8,
    padB = 28;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const allVals = series.flatMap((s) => s.values);
  const maxV = Math.max(...allVals, 1);
  const xStep = innerW / Math.max((series[0]?.values.length ?? 1) - 1, 1);
  const path = (vals: number[]) =>
    vals
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"} ${(padL + i * xStep).toFixed(2)} ${(padT + innerH - (v / maxV) * innerH).toFixed(2)}`,
      )
      .join(" ");
  const yTicks = 4;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: H, display: "block" }}
    >
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const y = padT + (innerH * i) / yTicks;
        const v = maxV * (1 - i / yTicks);
        return (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              stroke={i === yTicks ? C.rule : C.ruleSoft}
              strokeWidth={i === yTicks ? 1 : 0.5}
            />
            <text
              x={padL - 8}
              y={y + 3}
              fontSize="9"
              fill={C.ink3}
              textAnchor="end"
              fontFamily={FONT.mono}
            >
              {fmtUSD(v)}
            </text>
          </g>
        );
      })}
      {xLabels.map((lbl, i) => {
        if (i % Math.ceil(xLabels.length / 7) !== 0) return null;
        return (
          <text
            key={i}
            x={padL + i * xStep}
            y={H - 8}
            fontSize="9"
            fill={C.ink3}
            textAnchor="middle"
            fontFamily={FONT.mono}
          >
            {lbl}
          </text>
        );
      })}
      {series.map((s) => (
        <path
          key={s.label}
          d={path(s.values)}
          stroke={s.color}
          strokeWidth={s.weight ?? 1.5}
          fill="none"
          strokeDasharray={s.dashed ? "3 3" : undefined}
        />
      ))}
    </svg>
  );
}
