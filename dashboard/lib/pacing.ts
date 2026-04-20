import { aggKPIs } from "./aggregations";
import { CHANNELS, MARKETS } from "./taxonomy";
import { DEMO_AS_OF_ISO } from "./mock-panel";
import type { Channel, Market, PanelRow } from "./types";
import type { SmCell } from "@/components/charts/small-multiples";

export interface PacingMetric {
  actual: number;
  plan: number;
  forecast: number;
}

export interface ChannelPacingRow {
  id: Channel;
  label: string;
  actual: number;
  plan: number;
  forecast: number;
}

export interface PacingData {
  dayOfMonth: number;
  daysLeft: number;
  gmv: PacingMetric;
  spend: PacingMetric;
  orders: PacingMetric;
  roas: PacingMetric;
  byChannel: ChannelPacingRow[];
}

/** MTD vs plan with a linear extrapolation forecast. Plan values are
 *  fudged around the projected run-rate so the dials show some on/behind/over
 *  variation — real deployments should read plan from a budget table. */
export function computePacing(panel: PanelRow[], market: "all" | Market): PacingData {
  const today = new Date(DEMO_AS_OF_ISO);
  const dom = today.getUTCDate();
  const daysLeft = 30 - dom;
  const monthStart = `${DEMO_AS_OF_ISO.slice(0, 7)}-01`;
  const dates = [...new Set(panel.map((r) => r.date))]
    .sort()
    .filter((d) => d >= monthStart && d <= DEMO_AS_OF_ISO);
  let mtd = panel.filter((r) => dates.includes(r.date));
  if (market !== "all") mtd = mtd.filter((r) => r.market === market);

  const k = aggKPIs(mtd);
  const project = (v: number): number => (dom > 0 ? (v * 30) / dom : v);

  // Intentional mis-pacing multipliers so the dials tell a storytelling mix.
  const planMul = { gmv: 1.04, spend: 0.96, orders: 1.02, roas: 1.08 };

  const byChannel: ChannelPacingRow[] = CHANNELS.filter((c) => c.group !== "organic")
    .map((c) => {
      const cr = mtd.filter((r) => r.channel === c.id);
      const a = cr.reduce((acc, r) => acc + r.spend_usd, 0);
      const f = project(a);
      // Per-channel plan with some deterministic variation.
      const plan = f * (0.85 + (c.id.length % 5) * 0.07);
      return { id: c.id, label: c.label, actual: a, plan, forecast: f };
    })
    .sort((a, b) => b.actual - a.actual);

  return {
    dayOfMonth: dom,
    daysLeft,
    gmv: { actual: k.gmv, plan: project(k.gmv) * planMul.gmv, forecast: project(k.gmv) },
    spend: {
      actual: k.spend,
      plan: project(k.spend) * planMul.spend,
      forecast: project(k.spend),
    },
    orders: {
      actual: k.orders,
      plan: project(k.orders) * planMul.orders,
      forecast: project(k.orders),
    },
    roas: { actual: k.roas, plan: k.roas * planMul.roas, forecast: k.roas },
    byChannel,
  };
}

export interface SmallMultiplesData {
  rows: { id: Channel; label: string }[];
  cols: { id: Market; label: string }[];
  cells: Record<string, SmCell>;
}

/** Channel × market 14-day spend trajectory grid, with prior 7-day delta. */
export function computeSmallMultiples(
  panel: PanelRow[],
  market: "all" | Market,
): SmallMultiplesData {
  const allDates = [...new Set(panel.map((r) => r.date))].sort();
  const dates = allDates.slice(-14);
  const prevDates = allDates.slice(-21, -14);
  const rows = CHANNELS.filter((c) => c.group !== "organic").map((c) => ({
    id: c.id,
    label: c.label,
  }));
  const marketList = market === "all" ? MARKETS : MARKETS.filter((m) => m.code === market);
  const cols = marketList.map((m) => ({ id: m.code, label: m.code }));
  const cells: Record<string, SmCell> = {};
  for (const r of rows) {
    for (const c of cols) {
      const rs = panel.filter((p) => p.channel === r.id && p.market === c.id);
      const values = dates.map((d) =>
        rs.filter((p) => p.date === d).reduce((a, p) => a + p.spend_usd, 0),
      );
      const now = values.reduce((a, b) => a + b, 0);
      const prev = prevDates
        .map((d) => rs.filter((p) => p.date === d).reduce((a, p) => a + p.spend_usd, 0))
        .reduce((a, b) => a + b, 0);
      const delta = prev > 0 ? (now - prev) / prev : null;
      cells[`${r.id}|${c.id}`] = { values, now, delta };
    }
  }
  return { rows, cols, cells };
}
