import type { ChannelMeta, MarketMeta } from "./types";

export const MARKETS: MarketMeta[] = [
  { code: "ID", name: "Indonesia", currency: "IDR", tz: "Asia/Jakarta" },
  { code: "TH", name: "Thailand", currency: "THB", tz: "Asia/Bangkok" },
  { code: "VN", name: "Vietnam", currency: "VND", tz: "Asia/Ho_Chi_Minh" },
  { code: "MY", name: "Malaysia", currency: "MYR", tz: "Asia/Kuala_Lumpur" },
  { code: "SG", name: "Singapore", currency: "SGD", tz: "Asia/Singapore" },
  { code: "PH", name: "Philippines", currency: "PHP", tz: "Asia/Manila" },
];

/** Authoring order matches config/taxonomy.yaml. */
export const CHANNELS: ChannelMeta[] = [
  { id: "shopee_organic", label: "Shopee Organic", platform: "shopee", group: "organic" },
  { id: "shopee_ads_product_search", label: "Shopee Product Search", platform: "shopee", group: "on_platform" },
  { id: "shopee_ads_shop_search", label: "Shopee Shop Search", platform: "shopee", group: "on_platform" },
  { id: "shopee_ads_targeting", label: "Shopee Targeting", platform: "shopee", group: "on_platform" },
  { id: "shopee_ads_gmv_max", label: "Shopee GMV Max", platform: "shopee", group: "on_platform" },
  { id: "shopee_ads_affiliate", label: "Shopee Affiliate", platform: "shopee", group: "on_platform" },
  { id: "tiktok_shop_organic", label: "TikTok Shop Organic", platform: "tiktok_shop", group: "organic" },
  { id: "tiktok_shop_live", label: "TikTok Shop Live", platform: "tiktok_shop", group: "organic" },
  { id: "tiktok_shop_video", label: "TikTok Shop Video", platform: "tiktok_shop", group: "organic" },
  { id: "tiktok_ads", label: "TikTok Ads", platform: "tiktok_shop", group: "on_platform" },
  { id: "meta_cpas", label: "Meta CPAS", platform: "shopee", group: "off_platform" },
  { id: "google_ads_shopee", label: "Google Ads → Shopee", platform: "shopee", group: "off_platform" },
];

/**
 * Priority order for dropdowns and rankings — matches the final "narrative
 * lock" from the design chat: Shopee Ads → Google → Meta → TikTok → organic.
 * Spend hierarchy from the mock data follows the same order by construction.
 */
export const CHANNEL_PRIORITY: Record<string, number> = {
  shopee_ads_gmv_max: 1,
  shopee_ads_product_search: 2,
  shopee_ads_targeting: 3,
  shopee_ads_shop_search: 4,
  shopee_ads_affiliate: 5,
  google_ads_shopee: 6,
  meta_cpas: 7,
  tiktok_ads: 8,
  shopee_organic: 9,
  tiktok_shop_organic: 10,
  tiktok_shop_live: 11,
  tiktok_shop_video: 12,
};

export const sortByPriority = <T extends { id: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (CHANNEL_PRIORITY[a.id] ?? 99) - (CHANNEL_PRIORITY[b.id] ?? 99));
