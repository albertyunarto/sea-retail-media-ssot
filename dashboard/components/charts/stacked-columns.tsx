import { C, FONT } from "@/lib/tokens";

export function StackedColumns({
  height = 220,
  days = [],
  channels = [],
}: {
  height?: number;
  days: { label: string; values: number[] }[];
  channels: { color: string; label: string }[];
}) {
  const W = 800,
    H = height;
  const padL = 48,
    padR = 8,
    padT = 8,
    padB = 28;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const totals = days.map((d) => d.values.reduce((a, b) => a + b, 0));
  const maxV = Math.max(...totals, 1);
  const slot = innerW / Math.max(days.length, 1);
  const barW = slot * 0.62;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: H, display: "block" }}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const y = padT + (innerH * i) / 4;
        return (
          <line
            key={i}
            x1={padL}
            x2={W - padR}
            y1={y}
            y2={y}
            stroke={i === 4 ? C.rule : C.ruleSoft}
            strokeWidth={i === 4 ? 1 : 0.5}
          />
        );
      })}
      {days.map((d, i) => {
        let acc = 0;
        const x = padL + i * slot + (slot - barW) / 2;
        return (
          <g key={i}>
            {d.values.map((v, j) => {
              const h = (v / maxV) * innerH;
              const y = padT + innerH - acc - h;
              acc += h;
              return (
                <rect
                  key={j}
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  fill={channels[j]?.color ?? C.ink}
                />
              );
            })}
            {i % Math.ceil(days.length / 7) === 0 && (
              <text
                x={x + barW / 2}
                y={H - 8}
                fontSize="9"
                fill={C.ink3}
                textAnchor="middle"
                fontFamily={FONT.mono}
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
