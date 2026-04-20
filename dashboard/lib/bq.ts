/**
 * BigQuery adapter. Reads mart.daily_channel_panel (or the EVC variant when
 * the toggle is on) and returns PanelRow[] shaped for the dashboard.
 *
 * Safe to import from Server Components only — the BQ client is lazy-loaded
 * so the bundle doesn't drag google-cloud/bigquery into the client.
 */
import "server-only";
import type { BigQuery } from "@google-cloud/bigquery";
import type { PanelRow } from "./types";

let clientPromise: Promise<BigQuery | null> | null = null;

async function getClient(): Promise<BigQuery | null> {
  if (!clientPromise) {
    clientPromise = (async () => {
      if (process.env.NEXT_PUBLIC_USE_MOCK === "1") return null;
      if (!process.env.GCP_PROJECT) return null;
      try {
        const { BigQuery } = await import("@google-cloud/bigquery");
        const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        const opts: ConstructorParameters<typeof BigQuery>[0] = {
          projectId: process.env.GCP_PROJECT!,
          location: process.env.BQ_LOCATION ?? "asia-southeast1",
        };
        if (credsJson) opts.credentials = JSON.parse(credsJson);
        return new BigQuery(opts);
      } catch (e) {
        console.warn("[bq] failed to init, falling back to mock:", (e as Error).message);
        return null;
      }
    })();
  }
  return clientPromise;
}

export async function queryPanelFromBQ(opts: {
  evc: boolean;
  asOf?: string;
}): Promise<PanelRow[] | null> {
  const client = await getClient();
  if (!client) return null;

  const project = process.env.GCP_PROJECT!;
  const martDataset = process.env.MART_DATASET ?? "mart";
  const table = opts.evc ? "daily_channel_panel_evc" : "daily_channel_panel";
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);

  // We pull 30 days so we have enough for the filter bar + weekly story.
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', date_local) AS date,
      market,
      channel,
      platform,
      spend_usd,
      COALESCE(impressions, 0)           AS impressions,
      COALESCE(clicks, 0)                AS clicks,
      COALESCE(ads_attributed_orders, 0) AS ads_orders,
      COALESCE(ads_attributed_gmv_usd, 0) AS ads_gmv_usd,
      platform_total_gmv_usd,
      platform_total_orders,
      is_weekend,
      is_payday
      ${
        opts.evc
          ? `,
      COALESCE(evc_conversions, 0) AS evc_conversions,
      COALESCE(evc_gmv_usd, 0)     AS evc_gmv_usd`
          : ""
      }
    FROM \`${project}.${martDataset}.${table}\`
    WHERE date_local BETWEEN DATE_SUB(DATE(@as_of), INTERVAL 30 DAY) AND DATE(@as_of)
    ORDER BY date_local, market, channel
  `;
  const [rows] = await client.query({
    query: sql,
    params: { as_of: asOf },
    types: { as_of: "DATE" },
  });
  return rows as PanelRow[];
}
