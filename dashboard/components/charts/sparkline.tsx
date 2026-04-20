import { C } from "@/lib/tokens";

export function Sparkline({
  values,
  color = C.ink,
  width = 80,
  height = 22,
  fill = false,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  if (values.length === 0) return <svg width={width} height={height} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const xStep = width / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => [i * xStep, height - ((v - min) / range) * height] as const);
  const d = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {fill && (
        <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={color} opacity="0.12" />
      )}
      <path d={d} stroke={color} strokeWidth="1.25" fill="none" />
    </svg>
  );
}
