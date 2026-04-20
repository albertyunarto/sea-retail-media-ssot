/**
 * Analytical Terminal palette — cool only, no warm tones.
 * Matches the final design decision in the Claude Design handoff bundle.
 * Channel palette keys must match the SSOT taxonomy (config/taxonomy.yaml).
 */
export const C = {
  paper: "#F7F9FC",
  paper2: "#EEF2F7",
  ink: "#0B1220",
  ink2: "#334155",
  ink3: "#64748B",
  ink4: "#94A3B8",
  rule: "#0B1220",
  ruleSoft: "#D6DDE6",

  accent: "#2563EB", // electric blue — Google Ads hero, also "−" delta / warn
  accent2: "#3B82F6",
  // Legacy names retained for compat; remapped to cool hues.
  gold: "#0891B2", // cyan
  moss: "#059669", // emerald — "+" delta / ok
  indigo: "#4F46E5",
} as const;

/** Per-channel colour — cool ramp. Google is the hero accent blue;
 *  Shopee Ads sub-channels are deep slates (they carry the most spend);
 *  Meta is indigo; TikTok is muted cyan; organic is neutral grey. */
export const CHANNEL_COLOR: Record<string, string> = {
  shopee_ads_gmv_max: "#0B1220",
  shopee_ads_product_search: "#1E293B",
  shopee_ads_targeting: "#334155",
  shopee_ads_shop_search: "#475569",
  shopee_ads_affiliate: "#64748B",
  google_ads_shopee: "#2563EB",
  meta_cpas: "#4F46E5",
  tiktok_ads: "#0891B2",
  shopee_organic: "#94A3B8",
  tiktok_shop_organic: "#CBD5E1",
  tiktok_shop_live: "#B3C0CF",
  tiktok_shop_video: "#A3B1C2",
};

export const FONT = {
  sans: '"Inter Tight", ui-sans-serif, -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif',
  serif: '"Inter Tight", ui-sans-serif, -apple-system, system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
} as const;
