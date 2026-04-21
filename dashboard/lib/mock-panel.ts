/**
 * Deterministic browser-/server-side mock of `mart.daily_channel_panel` that
 * matches the narrative the Python simulation generator (PRD-A) emits on
 * seed=42: Google Ads → Shopee is the hero paid channel; Shopee Ads is the
 * dominant wallet bucket (all 5 sub-channels > Google individually);
 * Meta CPAS is third; TikTok Ads is small and low-ROAS.
 */
import { CHANNELS, MARKETS } from "./taxonomy";
import type { Channel, Market, PanelRow, Platform } from "./types";

const DEMO_AS_OF = new Date("2026-04-19T00:00:00Z");
const DEMO_DAYS = 30;

/** Per-channel wallet-share weight. Ordering:
 *  Shopee Ads (every sub-channel) > Google Ads > Meta CPAS > TikTok Ads. */
const CH_WEIGHT: Partial<Record<Channel, number>> = {
  shopee_ads_gmv_max: 4.6,
  shopee_ads_product_search: 3.8,
  shopee_ads_targeting: 3.2,
  shopee_ads_shop_search: 2.6,
  shopee_ads_affiliate: 2.2,
  google_ads_shopee: 2.1,
  meta_cpas: 1.3,
  tiktok_ads: 0.55,
};

/** Per-channel baseline ROAS — Google leads on efficiency. */
const CH_ROAS: Partial<Record<Channel, number>> = {
  google_ads_shopee: 1.55,
  shopee_ads_gmv_max: 1.3,
  shopee_ads_product_search: 1.25,
  shopee_ads_targeting: 1.15,
  shopee_ads_affiliate: 1.1,
  shopee_ads_shop_search: 1.05,
  meta_cpas: 1.2,
  tiktok_ads: 0.78,
};

/** Per-channel EVC coverage (fraction of all_conversions that are EVC). */
const CH_EVC: Partial<Record<Channel, number>> = {
  google_ads_shopee: 0.18,
  meta_cpas: 0.2,
  tiktok_ads: 0.25,
};

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

let cache: PanelRow[] | null = null;

/** Mirrors sql/seeds/05_seed_calendar_events.sql coverage, narrowed to the
 *  30-day mock window (2026-03-21 → 2026-04-19): no 11.11 / 12.12 in range,
 *  but 3.3, 4.4, Lebaran (ID+MY, Mar 20-22), Songkran (TH, Apr 13-15) are. */
function isMegaSaleDay(iso: string, market: string): boolean {
  const panSea = new Set(["2026-03-03", "2026-04-04"]);
  if (panSea.has(iso)) return true;
  // Lebaran ID + MY (3/20-3/22 covered by charter seasonality.yaml)
  if ((market === "ID" || market === "MY") &&
      iso >= "2026-03-20" && iso <= "2026-03-22") return true;
  // Songkran TH
  if (market === "TH" && iso >= "2026-04-13" && iso <= "2026-04-15") return true;
  return false;
}

export function getMockPanel(): PanelRow[] {
  if (cache) return cache;
  const rows: PanelRow[] = [];
  for (let d = DEMO_DAYS - 1; d >= 0; d--) {
    const date = new Date(DEMO_AS_OF);
    date.setUTCDate(DEMO_AS_OF.getUTCDate() - d);
    const iso = date.toISOString().slice(0, 10);
    const day = date.getUTCDay();
    const isWeekend = day === 0 || day === 6;
    const dom = date.getUTCDate();
    const isPayday = dom === 1 || dom === 15 || dom === 16;
    const seasonality = 1 + (isWeekend ? 0.18 : 0) + (isPayday ? 0.35 : 0);

    MARKETS.forEach((m, mi) => {
      const marketScale = [1.6, 1.0, 0.85, 0.55, 0.4, 0.75][mi]!;
      CHANNELS.forEach((c, ci) => {
        const r = seeded(d * 1000 + mi * 100 + ci);
        const w = CH_WEIGHT[c.id] ?? 1.0;
        const baseSpend =
          c.group === "organic"
            ? 0
            : c.group === "off_platform"
              ? (4500 + r() * 1500) * w
              : (5000 + r() * 1500) * w;
        const spend = baseSpend * marketScale * seasonality * (0.9 + r() * 0.2);
        const platformGmv =
          (c.platform === "shopee" ? 95000 : 62000) *
          marketScale *
          seasonality *
          (0.85 + r() * 0.3);
        const platformOrders = Math.round(platformGmv / (12 + r() * 6));
        const impressions = c.group === "organic" ? 0 : Math.round(spend * (140 + r() * 60));
        const clicks =
          c.group === "organic" ? 0 : Math.round(impressions * (0.012 + r() * 0.015));
        const targetRoas = CH_ROAS[c.id] ?? 0.95;
        const roasNoise = 0.92 + r() * 0.16;
        const adsGmv = c.group === "organic" ? 0 : spend * targetRoas * roasNoise;
        const adsOrders = c.group === "organic" ? 0 : Math.max(1, Math.round(adsGmv / (14 + r() * 10)));
        const evcCoverage = CH_EVC[c.id];
        const evcConversions =
          evcCoverage != null ? Math.round(adsOrders * (evcCoverage / (1 - evcCoverage))) : 0;
        const evcGmv = evcCoverage != null ? adsGmv * (evcCoverage / (1 - evcCoverage)) : 0;

        // Direct vs broad split:
        //   - Shopee ads sub-channels: direct = last-click, broad = direct + view-assisted.
        //     Model as direct = 55% of broad, so broad - direct gives a meaningful view-assist
        //     delta on the daily report.
        //   - Non-Shopee (TikTok Ads / Meta CPAS / Google Ads): duplicate direct = broad = adsGmv
        //     per charter decision (frontend doesn't branch on platform).
        //   - Organic: both undefined (NULL).
        let directGmv: number | undefined;
        let broadGmv: number | undefined;
        if (c.group === "organic") {
          directGmv = undefined;
          broadGmv = undefined;
        } else if (c.id.startsWith("shopee_ads_")) {
          broadGmv = adsGmv;
          directGmv = adsGmv * 0.55;
        } else {
          directGmv = adsGmv;
          broadGmv = adsGmv;
        }

        rows.push({
          date: iso,
          market: m.code as Market,
          channel: c.id,
          channelLabel: c.label,
          platform: c.platform as Platform,
          group: c.group,
          spend_usd: spend,
          impressions,
          clicks,
          ads_orders: adsOrders,
          ads_gmv_usd: adsGmv,
          direct_gmv_usd: directGmv,
          broad_gmv_usd: broadGmv,
          platform_total_gmv_usd: platformGmv,
          platform_total_orders: platformOrders,
          is_weekend: isWeekend,
          is_payday: isPayday,
          is_mega_sale: isMegaSaleDay(iso, m.code),
          evc_conversions: evcConversions,
          evc_gmv_usd: evcGmv,
        });
      });
    });
  }
  cache = rows;
  return rows;
}

export const DEMO_AS_OF_ISO = "2026-04-19";
