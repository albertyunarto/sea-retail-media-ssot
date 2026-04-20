import type { Channel, Market, PanelRow } from "./types";

export interface HeatmapCell {
  market: Market;
  date: string;
  value: number;
}

export interface HeatmapData {
  markets: Market[];
  dates: string[];
  cells: Record<string, number>; // `${market}|${date}` -> value
  max: number;
}

/** Market × day spend matrix for a single channel, last N days. */
export function computeHeatmap(
  panel: PanelRow[],
  channelId: Channel,
  markets: Market[],
  days = 21,
): HeatmapData {
  const dates = [...new Set(panel.map((r) => r.date))].sort().slice(-days);
  const cells: Record<string, number> = {};
  let max = 0;
  for (const m of markets) {
    for (const d of dates) {
      const v = panel
        .filter((r) => r.channel === channelId && r.market === m && r.date === d)
        .reduce((a, r) => a + r.spend_usd, 0);
      cells[`${m}|${d}`] = v;
      if (v > max) max = v;
    }
  }
  return { markets, dates, cells, max };
}
