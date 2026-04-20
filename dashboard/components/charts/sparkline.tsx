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
  /** Accepts either a pixel number or a CSS length (e.g. "100%"). When a
   *  string is passed, the SVG scales to its container; the path is
   *  computed against an internal 240-unit viewBox. */
  width?: number | string;
  height?: number;
  fill?: boolean;
}) {
  if (values.length === 0) return <svg width={width} height={height} />;
  const isResponsive = typeof width === "string";
  const innerW = isResponsive ? 240 : (width as number);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const xStep = innerW / Math.max(values.length - 1, 1);
  const pts = values.map(
    (v, i) => [i * xStep, height - ((v - min) / range) * height] as const,
  );
  const d = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={isResponsive ? `0 0 ${innerW} ${height}` : undefined}
      preserveAspectRatio={isResponsive ? "none" : undefined}
      style={{ display: "block" }}
    >
      {fill && (
        <path d={`${d} L ${innerW} ${height} L 0 ${height} Z`} fill={color} opacity="0.12" />
      )}
      <path d={d} stroke={color} strokeWidth="1.25" fill="none" />
    </svg>
  );
}
