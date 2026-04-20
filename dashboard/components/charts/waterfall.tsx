import { C, FONT } from "@/lib/tokens";
import { fmtUSD } from "@/lib/format";

export interface WaterfallItem {
  label: string;
  value: number;
  type: "start" | "plus" | "minus" | "end";
  color?: string;
  sub?: string;
}

export function Waterfall({
  height = 260,
  items = [],
}: {
  height?: number;
  items?: WaterfallItem[];
}) {
  const W = 800,
    H = height;
  const padL = 60,
    padR = 16,
    padT = 24,
    padB = 56;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;

  let running = 0;
  const bars = items.map((it) => {
    if (it.type === "start" || it.type === "end") {
      running = it.value;
      return { ...it, top: it.value, bottom: 0, anchor: it.value };
    }
    if (it.type === "plus") {
      const bottom = running;
      const top = running + it.value;
      running = top;
      return { ...it, top, bottom, anchor: top };
    }
    const top = running;
    const bottom = running + it.value;
    running = bottom;
    return { ...it, top, bottom, anchor: bottom };
  });

  const allVals = bars.flatMap((b) => [b.top, b.bottom]);
  const maxV = Math.max(...allVals, 1);
  const minV = Math.min(...allVals, 0);
  const range = maxV - minV || 1;
  const yPx = (v: number) => padT + innerH - ((v - minV) / range) * innerH;

  const slot = innerW / Math.max(bars.length, 1);
  const barW = slot * 0.62;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const v = minV + range * (1 - p);
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

      {bars.map((b, i) => {
        const x = padL + i * slot + (slot - barW) / 2;
        const yTop = yPx(Math.max(b.top, b.bottom));
        const yBot = yPx(Math.min(b.top, b.bottom));
        const h = Math.max(yBot - yTop, 1);
        const fill =
          b.color ??
          (b.type === "plus" ? C.moss : b.type === "minus" ? C.accent : C.ink);
        const next = bars[i + 1];
        const connY = yPx(b.anchor);
        return (
          <g key={i}>
            <rect x={x} y={yTop} width={barW} height={h} fill={fill} />
            <text
              x={x + barW / 2}
              y={yTop - 4}
              fontSize="10"
              fill={C.ink}
              textAnchor="middle"
              fontFamily={FONT.mono}
              fontWeight="600"
            >
              {b.type === "plus" ? "+" : b.type === "minus" ? "−" : ""}
              {fmtUSD(Math.abs(b.value))}
            </text>
            <text
              x={x + barW / 2}
              y={H - 32}
              fontSize="10"
              fill={C.ink2}
              textAnchor="middle"
              fontFamily={FONT.mono}
              letterSpacing="0.04em"
            >
              {b.label}
            </text>
            {b.sub && (
              <text
                x={x + barW / 2}
                y={H - 18}
                fontSize="8.5"
                fill={C.ink3}
                textAnchor="middle"
                fontFamily={FONT.mono}
              >
                {b.sub}
              </text>
            )}
            {next && next.type !== "start" && next.type !== "end" && (
              <line
                x1={x + barW}
                x2={padL + (i + 1) * slot + (slot - barW) / 2}
                y1={connY}
                y2={connY}
                stroke={C.ink3}
                strokeWidth="0.75"
                strokeDasharray="2 2"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
