/** Mirrors the PanelRow spec in PRD-B §8. */
export type Channel =
  | "shopee_organic"
  | "shopee_ads_product_search"
  | "shopee_ads_shop_search"
  | "shopee_ads_targeting"
  | "shopee_ads_gmv_max"
  | "shopee_ads_affiliate"
  | "tiktok_shop_organic"
  | "tiktok_shop_live"
  | "tiktok_shop_video"
  | "tiktok_ads"
  | "meta_cpas"
  | "google_ads_shopee";

export type Market = "ID" | "TH" | "VN" | "MY" | "SG" | "PH";

export type Group = "organic" | "on_platform" | "off_platform";

export type Platform = "shopee" | "tiktok_shop";

export interface PanelRow {
  date: string; // YYYY-MM-DD
  market: Market;
  channel: Channel;
  channelLabel: string;
  platform: Platform;
  group: Group;
  spend_usd: number;
  impressions: number;
  clicks: number;
  ads_orders: number;
  ads_gmv_usd: number;
  platform_total_gmv_usd: number;
  platform_total_orders: number;
  is_weekend: boolean;
  is_payday: boolean;
  /** EVC extension — 0 on non-EVC channels or when EVC is off. */
  evc_conversions?: number;
  evc_gmv_usd?: number;
}

export interface MarketMeta {
  code: Market;
  name: string;
  currency: string;
  tz: string;
}

export interface ChannelMeta {
  id: Channel;
  label: string;
  platform: Platform;
  group: Group;
}

export interface Filters {
  range: "7" | "14" | "30" | "mtd";
  market: Market | "all";
  evc: boolean;
  /** Controls which tab renders on /advanced. Unused on `/` (main page). */
  lens: "decisions" | "narrative" | "decomposition" | "channel";
}

export const DEFAULT_FILTERS: Filters = {
  range: "14",
  market: "all",
  evc: false,
  lens: "decisions",
};
