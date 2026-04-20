import { NextResponse } from "next/server";
import { getPanel, IS_MOCK } from "@/lib/panel-data";
import { MARKETS, CHANNELS } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

/**
 * Returns the date-range bounds + available markets/channels so the client
 * can populate filter dropdowns dynamically if we ever move filter state
 * off the URL.
 */
export async function GET() {
  const panel = await getPanel({ evc: false });
  const dates = [...new Set(panel.map((r) => r.date))].sort();
  return NextResponse.json({
    source: IS_MOCK ? "mock" : "bq",
    date_min: dates[0],
    date_max: dates[dates.length - 1],
    row_count: panel.length,
    markets: MARKETS.map((m) => m.code),
    channels: CHANNELS.map((c) => c.id),
  });
}
