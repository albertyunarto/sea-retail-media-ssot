export const fmtUSD = (n: number | null | undefined, compact = true): string => {
  if (n == null) return "—";
  if (compact) {
    if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
    return "$" + n.toFixed(0);
  }
  return "$" + Math.round(n).toLocaleString();
};

export const fmtNum = (n: number | null | undefined): string =>
  n == null ? "—" : Math.round(n).toLocaleString();

export const fmtPct = (n: number | null | undefined, d = 1): string =>
  n == null ? "—" : (n * 100).toFixed(d) + "%";

export const fmtDelta = (n: number | null | undefined, d = 1): string => {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "−") + Math.abs(n * 100).toFixed(d) + "%";
};
