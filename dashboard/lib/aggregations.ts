import type { Channel, Filters, Market, PanelRow } from "./types";
import { CHANNELS, MARKETS } from "./taxonomy";
import { DEMO_AS_OF_ISO } from "./mock-panel";

/** Apply the global filter bar (market + date range) to a panel. */
export function filterPanel(panel: PanelRow[], filters: Pick<Filters, "range" | "market">): PanelRow[] {
  const days = filters.range === "mtd" ? 20 : parseInt(filters.range, 10);
  const cutoff = new Date(DEMO_AS_OF_ISO).getTime() - (days - 1) * 86400000;
  let rows = panel.filter((r) => new Date(r.date).getTime() >= cutoff);
  if (filters.market !== "all") rows = rows.filter((r) => r.market === filters.market);
  return rows;
}

export function applyEvc(rows: PanelRow[], evc: boolean): PanelRow[] {
  if (!evc) return rows;
  // EVC toggle: inflate ads_gmv_usd + ads_orders with the EVC delta.
  return rows.map((r) => ({
    ...r,
    ads_gmv_usd: r.ads_gmv_usd + (r.evc_gmv_usd ?? 0),
    ads_orders: r.ads_orders + (r.evc_conversions ?? 0),
  }));
}

export interface AggKPIs {
  spend: number;
  gmv: number;
  orders: number;
  roas: number;
  adsGmv: number;
}

/** Aggregate spend / platform GMV (dedup'd per date×market×platform) / orders / blended ROAS. */
export function aggKPIs(rows: PanelRow[]): AggKPIs {
  const spend = rows.reduce((a, r) => a + r.spend_usd, 0);
  const seen = new Set<string>();
  let gmv = 0,
    orders = 0;
  rows.forEach((r) => {
    const k = `${r.date}|${r.market}|${r.platform}`;
    if (seen.has(k)) return;
    seen.add(k);
    gmv += r.platform_total_gmv_usd ?? 0;
    orders += r.platform_total_orders ?? 0;
  });
  const adsGmv = rows.reduce((a, r) => a + (r.ads_gmv_usd ?? 0), 0);
  const roas = spend > 0 ? adsGmv / spend : 0;
  return { spend, gmv, orders, roas, adsGmv };
}

const pctDelta = (now: number, prev: number): number | null =>
  prev ? (now - prev) / prev : null;

export interface ChannelDelta {
  id: Channel;
  label: string;
  group: "organic" | "on_platform" | "off_platform";
  platform: "shopee" | "tiktok_shop";
  spendNow: number;
  spendPrev: number;
  spendDelta: number | null;
  gmvNow: number;
  gmvPrev: number;
  roasNow: number;
  roasPrev: number;
  roasShift: number;
  roasShiftPct: number;
}

export interface MarketDelta {
  code: Market;
  name: string;
  gmvDelta: number | null;
  spendDelta: number | null;
  roasDelta: number | null;
  gmvNow: number;
  spendNow: number;
  roasNow: number;
}

export interface WeeklyStory {
  market: "all" | Market;
  weeks: { now: string[]; prev: string[] };
  blended: {
    now: AggKPIs;
    prev: AggKPIs;
    spendDelta: number | null;
    gmvDelta: number | null;
    roasDelta: number | null;
    ordersDelta: number | null;
  };
  channelDeltas: ChannelDelta[];
  marketDeltas: MarketDelta[];
  topMover: ChannelDelta | undefined;
  topRoasShift: ChannelDelta | undefined;
  leadMarket: MarketDelta | undefined;
  daily: { dates: string[]; spend: number[]; gmv: number[] };
}

/** Split into this-week / prior-week on the last 14 days of the panel. */
export function computeWeeklyStory(
  panel: PanelRow[],
  market: "all" | Market,
): WeeklyStory | null {
  let rows = panel;
  if (market !== "all") rows = rows.filter((r) => r.market === market);
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  if (dates.length < 14) return null;
  const thisWk = dates.slice(-7);
  const prevWk = dates.slice(-14, -7);
  const thisRows = rows.filter((r) => thisWk.includes(r.date));
  const prevRows = rows.filter((r) => prevWk.includes(r.date));

  const blendedNow = aggKPIs(thisRows);
  const blendedPrev = aggKPIs(prevRows);

  const channelDeltas: ChannelDelta[] = CHANNELS.filter((c) => c.group !== "organic").map((c) => {
    const nowSp = thisRows.filter((r) => r.channel === c.id).reduce((a, r) => a + r.spend_usd, 0);
    const prevSp = prevRows.filter((r) => r.channel === c.id).reduce((a, r) => a + r.spend_usd, 0);
    const nowGmv = thisRows
      .filter((r) => r.channel === c.id)
      .reduce((a, r) => a + (r.ads_gmv_usd ?? 0), 0);
    const prevGmv = prevRows
      .filter((r) => r.channel === c.id)
      .reduce((a, r) => a + (r.ads_gmv_usd ?? 0), 0);
    const roasNow = nowSp > 0 ? nowGmv / nowSp : 0;
    const roasPrev = prevSp > 0 ? prevGmv / prevSp : 0;
    const roasShift = roasNow - roasPrev;
    const roasShiftPct = roasPrev > 0 ? roasShift / roasPrev : 0;
    return {
      id: c.id,
      label: c.label,
      group: c.group,
      platform: c.platform,
      spendNow: nowSp,
      spendPrev: prevSp,
      spendDelta: pctDelta(nowSp, prevSp),
      gmvNow: nowGmv,
      gmvPrev: prevGmv,
      roasNow,
      roasPrev,
      roasShift,
      roasShiftPct,
    };
  });

  const marketDeltas: MarketDelta[] = MARKETS.map((m) => {
    const nowMr = thisRows.filter((r) => r.market === m.code);
    const prevMr = prevRows.filter((r) => r.market === m.code);
    const n = aggKPIs(nowMr);
    const p = aggKPIs(prevMr);
    return {
      code: m.code,
      name: m.name,
      gmvDelta: pctDelta(n.gmv, p.gmv),
      spendDelta: pctDelta(n.spend, p.spend),
      roasDelta: pctDelta(n.roas, p.roas),
      gmvNow: n.gmv,
      spendNow: n.spend,
      roasNow: n.roas,
    };
  });

  const allDates = [...prevWk, ...thisWk];
  const dailySpend = allDates.map((d) =>
    rows.filter((r) => r.date === d).reduce((a, r) => a + r.spend_usd, 0),
  );
  const dailyGmv = allDates.map((d) => {
    const seen = new Set<string>();
    let g = 0;
    rows
      .filter((r) => r.date === d)
      .forEach((r) => {
        const k = `${r.date}|${r.market}|${r.platform}`;
        if (!seen.has(k)) {
          seen.add(k);
          g += r.platform_total_gmv_usd ?? 0;
        }
      });
    return g;
  });

  const material = channelDeltas.filter(
    (c) => c.spendNow > 5000 && c.spendPrev > 5000 && c.spendDelta != null,
  );
  const topMover = [...material].sort(
    (a, b) => Math.abs(b.spendDelta ?? 0) - Math.abs(a.spendDelta ?? 0),
  )[0];
  const topRoasShift = [...material].sort(
    (a, b) => Math.abs(b.roasShift) - Math.abs(a.roasShift),
  )[0];
  const leadMarket = [...marketDeltas].sort((a, b) => b.gmvNow - a.gmvNow)[0];

  return {
    market,
    weeks: { now: thisWk, prev: prevWk },
    blended: {
      now: blendedNow,
      prev: blendedPrev,
      spendDelta: pctDelta(blendedNow.spend, blendedPrev.spend),
      gmvDelta: pctDelta(blendedNow.gmv, blendedPrev.gmv),
      roasDelta: pctDelta(blendedNow.roas, blendedPrev.roas),
      ordersDelta: pctDelta(blendedNow.orders, blendedPrev.orders),
    },
    channelDeltas: channelDeltas.sort((a, b) => b.spendNow - a.spendNow),
    marketDeltas,
    topMover,
    topRoasShift,
    leadMarket,
    daily: { dates: allDates, spend: dailySpend, gmv: dailyGmv },
  };
}

/** 14-day connected-scatter path (spend × ROAS) for one channel. */
export function computeChannelTrend(
  panel: PanelRow[],
  channelId: Channel,
  market: "all" | Market = "all",
): { date: string; spend: number; roas: number }[] {
  const dates = [...new Set(panel.map((r) => r.date))].sort().slice(-14);
  return dates.map((d) => {
    let rs = panel.filter((r) => r.date === d && r.channel === channelId);
    if (market !== "all") rs = rs.filter((r) => r.market === market);
    const spend = rs.reduce((a, r) => a + r.spend_usd, 0);
    const adsGmv = rs.reduce((a, r) => a + (r.ads_gmv_usd ?? 0), 0);
    return { date: d, spend, roas: spend > 0 ? adsGmv / spend : 0 };
  });
}
