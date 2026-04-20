import { C, FONT } from "@/lib/tokens";

export interface ScatterPoint {
  date: string;
  spend: number;
  roas: number;
}

export function ConnectedScatter({
  height = 280,
  points = [],
  label = "",
}: {
  height?: number;
  points?: ScatterPoint[];
  label?: string;
}) {
  const W = 600,
    H = height;
  const padL = 52,
    padR = 16,
    padT = 24,
    padB = 36;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  if (points.length === 0) return <svg viewBox={`0 0 ${W} ${H}`} />;

  const spends = points.map((p) => p.spend);
  const roases = points.map((p) => p.roas);
  const sMin = Math.min(...spends) * 0.9;
  const sMax = Math.max(...spends) * 1.05;
  const rMin = Math.min(...roases) * 0.9;
  const rMax = Math.max(...roases) * 1.05;
  const xPx = (s: number) => padL + ((s - sMin) / Math.max(sMax - sMin, 1)) * innerW;
  const yPx = (r: number) =>
    padT + innerH - ((r - rMin) / Math.max(rMax - rMin, 0.01)) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xPx(p.spend).toFixed(2)} ${yPx(p.roas).toFixed(2)}`)
    .join(" ");

  const sAvg = spends.reduce((a, b) => a + b, 0) / spends.length;
  const rAvg = roases.reduce((a, b) => a + b, 0) / roases.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      <line
        x1={xPx(sAvg)}
        x2={xPx(sAvg)}
        y1={padT}
        y2={H - padB}
        stroke={C.ruleSoft}
        strokeDasharray="3 3"
      />
      <line
        x1={padL}
        x2={W - padR}
        y1={yPx(rAvg)}
        y2={yPx(rAvg)}
        stroke={C.ruleSoft}
        strokeDasharray="3 3"
      />
      <text
        x={W - padR - 4}
        y={padT + 10}
        fontSize="8.5"
        fill={C.ink3}
        textAnchor="end"
        fontFamily={FONT.mono}
      >
        HIGH ROAS · HIGH SPEND
      </text>
      <text
        x={padL + 4}
        y={H - padB - 4}
        fontSize="8.5"
        fill={C.ink3}
        fontFamily={FONT.mono}
      >
        LOW ROAS · LOW SPEND
      </text>

      <path d={path} stroke={C.ink2} strokeWidth="1" fill="none" opacity="0.55" />

      {points.map((p, i) => {
        const t = i / Math.max(points.length - 1, 1);
        const isLast = i === points.length - 1;
        return (
          <g key={i}>
            <circle
              cx={xPx(p.spend)}
              cy={yPx(p.roas)}
              r={isLast ? 5 : 2.5}
              fill={isLast ? C.accent : C.ink}
              opacity={isLast ? 1 : 0.25 + 0.7 * t}
            />
            {isLast && (
              <text
                x={xPx(p.spend) + 8}
                y={yPx(p.roas) + 4}
                fontSize="9.5"
                fill={C.accent}
                fontFamily={FONT.mono}
                fontWeight="700"
              >
                {p.date.slice(5)} · {p.roas.toFixed(2)}×
              </text>
            )}
            {i === 0 && (
              <text
                x={xPx(p.spend) - 6}
                y={yPx(p.roas) - 6}
                fontSize="9"
                fill={C.ink3}
                fontFamily={FONT.mono}
                textAnchor="end"
              >
                start {p.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}

      <text
        x={padL + innerW / 2}
        y={H - 6}
        fontSize="9"
        fill={C.ink3}
        textAnchor="middle"
        fontFamily={FONT.mono}
        letterSpacing="0.10em"
      >
        SPEND →
      </text>
      <text
        x={14}
        y={padT + innerH / 2}
        fontSize="9"
        fill={C.ink3}
        fontFamily={FONT.mono}
        letterSpacing="0.10em"
        transform={`rotate(-90, 14, ${padT + innerH / 2})`}
      >
        ROAS ↑
      </text>
      {label && (
        <text
          x={padL}
          y={padT - 8}
          fontSize="10"
          fill={C.ink}
          fontFamily={FONT.mono}
          fontWeight="700"
          letterSpacing="0.08em"
        >
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
