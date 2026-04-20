import { C, FONT } from "@/lib/tokens";

export interface MarimekkoItem {
  id: string;
  label: string;
  color: string;
  spend: number;
  roas: number;
  gmv?: number;
}

export function Marimekko({
  height = 320,
  items = [],
}: {
  height?: number;
  items?: MarimekkoItem[];
}) {
  const W = 800,
    H = height;
  const padL = 56,
    padR = 12,
    padT = 24,
    padB = 36;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;

  const totalSpend = items.reduce((a, i) => a + i.spend, 0) || 1;
  const maxRoas = Math.max(...items.map((i) => i.roas), 1) * 1.1;
  const xPx = (s: number) => (s / totalSpend) * innerW;

  const avg = items.reduce((a, i) => a + i.roas * i.spend, 0) / totalSpend;
  const avgY = padT + innerH - (avg / maxRoas) * innerH;

  let cx = padL;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const v = maxRoas * (1 - p);
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
              {v.toFixed(1)}×
            </text>
          </g>
        );
      })}
      <line
        x1={padL}
        x2={W - padR}
        y1={avgY}
        y2={avgY}
        stroke={C.accent}
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <text
        x={W - padR - 4}
        y={avgY - 4}
        fontSize="9"
        fill={C.accent}
        textAnchor="end"
        fontFamily={FONT.mono}
        fontWeight="700"
      >
        BLENDED {avg.toFixed(2)}×
      </text>

      {items.map((it) => {
        const w = xPx(it.spend);
        const h = (it.roas / maxRoas) * innerH;
        const y = padT + innerH - h;
        const x = cx;
        cx += w;
        return (
          <g key={it.id}>
            <rect x={x} y={y} width={Math.max(w - 1, 0)} height={h} fill={it.color} opacity={0.92} />
            {w > 30 && (
              <text
                x={x + w / 2}
                y={y - 4}
                fontSize="10"
                fill={C.ink}
                textAnchor="middle"
                fontFamily={FONT.mono}
                fontWeight="600"
              >
                {it.roas.toFixed(2)}×
              </text>
            )}
            {w > 36 && (
              <g>
                <text
                  x={x + w / 2}
                  y={padT + innerH + 14}
                  fontSize="9.5"
                  fill={C.ink2}
                  textAnchor="middle"
                  fontFamily={FONT.mono}
                  letterSpacing="0.02em"
                >
                  {it.label.length > 14 ? it.label.slice(0, 13) + "…" : it.label}
                </text>
                <text
                  x={x + w / 2}
                  y={padT + innerH + 26}
                  fontSize="8.5"
                  fill={C.ink3}
                  textAnchor="middle"
                  fontFamily={FONT.mono}
                >
                  {((it.spend / totalSpend) * 100).toFixed(0)}% spend
                </text>
              </g>
            )}
          </g>
        );
      })}

      <text
        x={padL - 44}
        y={padT + innerH / 2}
        fontSize="9"
        fill={C.ink3}
        textAnchor="middle"
        fontFamily={FONT.mono}
        letterSpacing="0.10em"
        transform={`rotate(-90, ${padL - 44}, ${padT + innerH / 2})`}
      >
        ROAS ↑
      </text>
    </svg>
  );
}
