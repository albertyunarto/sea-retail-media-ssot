import "server-only";
import { CHANNELS } from "./taxonomy";
import { getMockPanel } from "./mock-panel";
import { queryPanelFromBQ } from "./bq";
import type { PanelRow, Channel } from "./types";

/**
 * Central server-side data fetch. If BQ is unreachable or mock mode is on,
 * returns the deterministic in-memory panel. Always returns labelled rows
 * (adds channelLabel / group from the taxonomy so downstream UI never has
 * to join back to the config).
 */
export async function getPanel(opts: { evc: boolean }): Promise<PanelRow[]> {
  let raw = await queryPanelFromBQ({ evc: opts.evc });
  if (!raw) raw = getMockPanel();

  // Enrich with channel metadata (label + group) regardless of source.
  const meta = new Map(CHANNELS.map((c) => [c.id, c]));
  return raw.map((r) => {
    const m = meta.get(r.channel as Channel);
    return {
      ...r,
      channelLabel: r.channelLabel ?? m?.label ?? r.channel,
      group: (r.group ?? m?.group ?? "on_platform") as PanelRow["group"],
      platform: (r.platform ?? m?.platform ?? "shopee") as PanelRow["platform"],
    };
  });
}

export const IS_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK === "1" || !process.env.GCP_PROJECT;
