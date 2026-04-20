import { fmtDelta, fmtUSD } from "./format";
import type { ChannelDelta, WeeklyStory } from "./aggregations";
import type { Channel } from "./types";

export type Action = "scale" | "cut" | "shift";

export interface EvidenceChip {
  channel: Channel;
  label: string;
  value: string;
}

export interface SparklinePairPoint {
  id: Channel;
  label: string;
  values: number[];
  value: string;
}

export interface CompareBarPoint {
  id: Channel | "blended";
  label: string;
  now: number;
  prior: number;
  metric: string;
}

export type ChartData =
  | { chartType: "compare-bars"; chartData: CompareBarPoint[] }
  | { chartType: "sparkline-pair"; chartData: SparklinePairPoint[] };

export interface Decision {
  action: Action;
  from?: Channel;
  to?: Channel;
  market: string;
  headline: string;
  because: string;
  conviction: "high" | "medium" | "low";
  confidence: string;
  impact: number;
  chartLabel: string;
  evidence: EvidenceChip[];
  chart: ChartData;
}

/**
 * Build three pinned decision cards in priority order:
 *   1. Google Ads → Shopee — scale/cut depending on the channel's own ROAS shift
 *   2. Shopee Ads — the largest of the 5 shopee_ads_* sub-channels
 *   3. Meta CPAS — paired as a shift candidate against the best unpinned channel
 * Action verbs, evidence chips, and charts all derive from the WoW deltas so
 * the cards stay grounded rather than scripted.
 */
export function buildDecisionList(story: WeeklyStory): Decision[] {
  const byId = (id: Channel): ChannelDelta | undefined =>
    story.channelDeltas.find((c) => c.id === id);

  const scaleUp = byId("google_ads_shopee");
  const shopeeAdsIds: Channel[] = [
    "shopee_ads_gmv_max",
    "shopee_ads_product_search",
    "shopee_ads_targeting",
    "shopee_ads_shop_search",
    "shopee_ads_affiliate",
  ];
  const cutBack = shopeeAdsIds
    .map(byId)
    .filter((x): x is ChannelDelta => Boolean(x))
    .sort((a, b) => b.spendNow - a.spendNow)[0];
  const metaCpas = byId("meta_cpas");

  const pinnedIds = new Set<string>(
    [scaleUp?.id, cutBack?.id, metaCpas?.id].filter(Boolean) as string[],
  );
  const partner = story.channelDeltas
    .filter((c) => !pinnedIds.has(c.id) && c.spendNow > 3000 && c.roasPrev > 0)
    .sort((a, b) => b.roasNow - a.roasNow)[0];

  const moves: Decision[] = [];

  if (scaleUp) {
    const isTrim = scaleUp.roasShiftPct < -0.08;
    const action: Action = isTrim ? "cut" : "scale";
    const dollars = Math.round(scaleUp.spendNow * 0.15);
    const expected = isTrim
      ? -Math.round(dollars * (scaleUp.roasNow * 0.4))
      : Math.round(dollars * scaleUp.roasNow);
    moves.push({
      action,
      from: isTrim ? scaleUp.id : undefined,
      to: isTrim ? undefined : scaleUp.id,
      market: String(story.market),
      headline: isTrim
        ? `Trim ${scaleUp.label} by 15% — ROAS slipped ${(scaleUp.roasShiftPct * 100).toFixed(0)}% WoW`
        : `Scale ${scaleUp.label} by +15% — ROAS holds at ${scaleUp.roasNow.toFixed(2)}× with room`,
      because: isTrim
        ? `${scaleUp.label} retreated from ${scaleUp.roasPrev.toFixed(2)}× to ${scaleUp.roasNow.toFixed(2)}× while spend ran ${fmtDelta(scaleUp.spendDelta, 0)}. Pull the marginal dollars before they compound.`
        : `Spend at ${fmtUSD(scaleUp.spendNow)} this week is delivering ${scaleUp.roasNow.toFixed(2)}× against a blended ${story.blended.now.roas.toFixed(2)}×. ${scaleUp.roasShift >= 0 ? "The curve is still climbing" : "The small ROAS slip is within noise"}; incremental dollars look efficient before saturation kicks in.`,
      conviction: "high",
      confidence: "±18% range",
      impact: expected,
      chartLabel: "ROAS this wk vs prior",
      chart: {
        chartType: "compare-bars",
        chartData: [
          {
            id: scaleUp.id,
            label: "this channel",
            now: scaleUp.roasNow,
            prior: scaleUp.roasPrev,
            metric: `${scaleUp.roasNow.toFixed(2)}× → ${scaleUp.roasPrev.toFixed(2)}× prior`,
          },
          {
            id: "blended",
            label: "blended",
            now: story.blended.now.roas,
            prior: story.blended.prev.roas,
            metric: `blended ${story.blended.now.roas.toFixed(2)}×`,
          },
        ],
      },
      evidence: [
        { channel: scaleUp.id, label: "spend", value: fmtUSD(scaleUp.spendNow) },
        { channel: scaleUp.id, label: "attr GMV", value: fmtUSD(scaleUp.gmvNow) },
        { channel: scaleUp.id, label: "WoW", value: fmtDelta(scaleUp.spendDelta, 1) },
      ],
    });
  }

  if (cutBack) {
    const isTrim = cutBack.roasShiftPct < -0.05;
    const action: Action = isTrim ? "cut" : "scale";
    const dollars = Math.round(cutBack.spendNow * (isTrim ? 0.2 : 0.12));
    const expected = isTrim
      ? -Math.round(dollars * (cutBack.roasNow * 0.4))
      : Math.round(dollars * cutBack.roasNow);
    moves.push({
      action,
      from: isTrim ? cutBack.id : undefined,
      to: isTrim ? undefined : cutBack.id,
      market: String(story.market),
      headline: isTrim
        ? `Trim ${cutBack.label} by 20% — ROAS slipped ${(cutBack.roasShiftPct * 100).toFixed(0)}% on flat spend`
        : `Scale ${cutBack.label} by +12% — ROAS at ${cutBack.roasNow.toFixed(2)}× with headroom`,
      because: isTrim
        ? `Working spend rose ${fmtDelta(cutBack.spendDelta, 0)} WoW while ROAS retreated from ${cutBack.roasPrev.toFixed(2)}× to ${cutBack.roasNow.toFixed(2)}×. Classic diminishing-returns shape; trimming the marginal dollars should cost little measured GMV.`
        : `${cutBack.label} delivered ${cutBack.roasNow.toFixed(2)}× this week, ${cutBack.roasShiftPct >= 0 ? "up" : "roughly flat"} from ${cutBack.roasPrev.toFixed(2)}×. Spend at ${fmtUSD(cutBack.spendNow)} hasn't hit the saturation knee yet.`,
      conviction: "medium",
      confidence: "±26% range",
      impact: expected,
      chartLabel: isTrim ? "spend ↑ · ROAS ↓" : "spend & ROAS, trailing",
      chart: {
        chartType: "sparkline-pair",
        chartData: [
          {
            id: cutBack.id,
            label: "spend",
            values: [
              cutBack.spendPrev * 0.92,
              cutBack.spendPrev,
              (cutBack.spendPrev + cutBack.spendNow) / 2,
              cutBack.spendNow * 0.98,
              cutBack.spendNow,
            ],
            value: fmtUSD(cutBack.spendNow),
          },
          {
            id: cutBack.id,
            label: "ROAS",
            values: [
              cutBack.roasPrev,
              cutBack.roasPrev * (isTrim ? 1.02 : 0.98),
              (cutBack.roasPrev + cutBack.roasNow) / 2,
              cutBack.roasNow * (isTrim ? 1.01 : 0.99),
              cutBack.roasNow,
            ],
            value: cutBack.roasNow.toFixed(2) + "×",
          },
        ],
      },
      evidence: [
        { channel: cutBack.id, label: "spend", value: fmtUSD(cutBack.spendNow) },
        { channel: cutBack.id, label: "WoW", value: fmtDelta(cutBack.spendDelta, 1) },
        { channel: cutBack.id, label: "ROAS Δ", value: fmtDelta(cutBack.roasShiftPct, 1) },
      ],
    });
  }

  if (metaCpas && partner) {
    const dollars = Math.round(Math.min(metaCpas.spendNow, partner.spendNow) * 0.1);
    const expected = Math.round(dollars * (partner.roasNow - metaCpas.roasNow));
    moves.push({
      action: "shift",
      from: metaCpas.id,
      to: partner.id,
      market: String(story.market),
      headline: `Reallocate ${fmtUSD(dollars)} from ${metaCpas.label} → ${partner.label}`,
      because: `${partner.label} is returning ${partner.roasNow.toFixed(2)}× against ${metaCpas.label}'s ${metaCpas.roasNow.toFixed(2)}×. Category-overlap audiences suggest a 10% cross-funding test should move the needle without creative fatigue.`,
      conviction: "medium",
      confidence: "directional only",
      impact: Math.max(expected, 0),
      chartLabel: "side-by-side ROAS",
      chart: {
        chartType: "compare-bars",
        chartData: [
          {
            id: partner.id,
            label: partner.label,
            now: partner.roasNow,
            prior: partner.roasPrev,
            metric: partner.roasNow.toFixed(2) + "×",
          },
          {
            id: metaCpas.id,
            label: metaCpas.label,
            now: metaCpas.roasNow,
            prior: metaCpas.roasPrev,
            metric: metaCpas.roasNow.toFixed(2) + "×",
          },
        ],
      },
      evidence: [
        { channel: partner.id, label: "to", value: partner.roasNow.toFixed(2) + "×" },
        { channel: metaCpas.id, label: "from", value: metaCpas.roasNow.toFixed(2) + "×" },
        { channel: partner.id, label: "shift", value: fmtUSD(dollars) },
      ],
    });
  }

  return moves;
}
