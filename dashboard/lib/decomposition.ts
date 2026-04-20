import { C, CHANNEL_COLOR } from "./tokens";
import { fmtNum, fmtPct } from "./format";
import type { WaterfallItem } from "@/components/charts/waterfall";
import type { Lever } from "@/components/charts/lever-bridge";
import type { MarimekkoItem } from "@/components/charts/marimekko";
import type { WeeklyStory } from "./aggregations";
import type { Channel, Market, PanelRow } from "./types";

export function shortLabel(s: string): string {
  return s
    .replace("Shopee ", "")
    .replace("TikTok Shop ", "TT ")
    .replace("TikTok ", "TT ")
    .replace("Google Ads → ", "GAds→");
}

/** Start (prior GMV) → top 6 channel deltas → Other → End (this GMV). */
export function buildWaterfallItems(story: WeeklyStory): WaterfallItem[] {
  const channelGmvDeltas = story.channelDeltas
    .filter((c) => c.spendNow > 1500 || c.spendPrev > 1500)
    .map((c) => ({
      id: c.id,
      label: shortLabel(c.label),
      delta: (c.gmvNow ?? 0) - (c.gmvPrev ?? 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);

  const accountedIds = new Set(channelGmvDeltas.map((c) => c.id));
  const otherDelta = story.channelDeltas
    .filter((c) => !accountedIds.has(c.id))
    .reduce((a, c) => a + ((c.gmvNow ?? 0) - (c.gmvPrev ?? 0)), 0);

  return [
    {
      label: "Prior wk",
      sub: story.weeks.prev[0]?.slice(5),
      value: story.blended.prev.gmv,
      type: "start",
    },
    ...channelGmvDeltas.map((c) => ({
      label: c.label,
      value: c.delta,
      type: (c.delta >= 0 ? "plus" : "minus") as WaterfallItem["type"],
      color: CHANNEL_COLOR[c.id] ?? C.ink,
    })),
    {
      label: "Other",
      value: otherDelta,
      type: (otherDelta >= 0 ? "plus" : "minus") as WaterfallItem["type"],
      color: C.ink3,
    },
    {
      label: "This wk",
      sub: story.weeks.now[6]?.slice(5),
      value: story.blended.now.gmv,
      type: "end",
    },
  ];
}

/**
 * CTR × CVR × AOV lever bridge for one channel. Uses log-share decomposition
 * to split the GMV delta across impressions, CTR, CVR, AOV contributions.
 */
export function buildLevers(
  panel: PanelRow[],
  channelId: Channel,
  market: "all" | Market,
): Lever[] {
  const dates = [...new Set(panel.map((r) => r.date))].sort();
  const thisWk = dates.slice(-7);
  const prevWk = dates.slice(-14, -7);

  const slice = (wk: string[]) => {
    let rs = panel.filter((r) => r.channel === channelId && wk.includes(r.date));
    if (market !== "all") rs = rs.filter((r) => r.market === market);
    const impr = rs.reduce((a, r) => a + (r.impressions || 0), 0);
    const clk = rs.reduce((a, r) => a + (r.clicks || 0), 0);
    const ord = rs.reduce((a, r) => a + (r.ads_orders || 0), 0);
    const gmv = rs.reduce((a, r) => a + (r.ads_gmv_usd || 0), 0);
    return {
      impr,
      clk,
      ord,
      gmv,
      ctr: impr > 0 ? clk / impr : 0,
      cvr: clk > 0 ? ord / clk : 0,
      aov: ord > 0 ? gmv / ord : 0,
    };
  };

  const now = slice(thisWk);
  const prev = slice(prevWk);
  const lnRatio = (n: number, p: number): number =>
    p > 0 && n > 0 ? Math.log(n / p) : 0;
  const dGmv = now.gmv - prev.gmv;
  const totLn =
    lnRatio(now.impr, prev.impr) +
    lnRatio(now.ctr, prev.ctr) +
    lnRatio(now.cvr, prev.cvr) +
    lnRatio(now.aov, prev.aov);
  const share = (k: "impr" | "ctr" | "cvr" | "aov"): number =>
    totLn !== 0 ? lnRatio(now[k], prev[k]) / totLn : 0;

  return [
    {
      name: "Impressions",
      prevValue: fmtNum(prev.impr),
      nowValue: fmtNum(now.impr),
      contribution: dGmv * share("impr"),
    },
    {
      name: "CTR (click-through)",
      prevValue: fmtPct(prev.ctr, 2),
      nowValue: fmtPct(now.ctr, 2),
      contribution: dGmv * share("ctr"),
    },
    {
      name: "CVR (conversion)",
      prevValue: fmtPct(prev.cvr, 2),
      nowValue: fmtPct(now.cvr, 2),
      contribution: dGmv * share("cvr"),
    },
    {
      name: "AOV (basket)",
      prevValue: "$" + prev.aov.toFixed(1),
      nowValue: "$" + now.aov.toFixed(1),
      contribution: dGmv * share("aov"),
    },
  ];
}

/** Marimekko items for the current week — bar width = spend share, height = ROAS. */
export function buildMarimekkoItems(story: WeeklyStory): MarimekkoItem[] {
  return story.channelDeltas
    .filter((c) => c.spendNow > 1000)
    .map((c) => ({
      id: c.id,
      label: shortLabel(c.label),
      color: CHANNEL_COLOR[c.id] ?? C.ink,
      spend: c.spendNow,
      roas: c.roasNow,
      gmv: c.gmvNow,
    }))
    .sort((a, b) => b.spend - a.spend);
}
