import { C, CHANNEL_COLOR, FONT } from "@/lib/tokens";
import { KPI, SectionHead } from "@/components/primitives";
import { PacingDial } from "@/components/charts/pacing-dial";
import { fmtDelta, fmtNum, fmtUSD } from "@/lib/format";
import {
  applyEvc,
  aggKPIs,
  computeAnomaly,
  computeWeeklyStory,
  filterPanel,
} from "@/lib/aggregations";
import { computePacing } from "@/lib/pacing";
import { CHANNELS, sortByPriority } from "@/lib/taxonomy";
import type { Filters, PanelRow } from "@/lib/types";

/**
 * MVP main dashboard — designed for campaign managers. Single scroll:
 *   1) Blended KPI strip (Spend / GMV / ROAS / Orders with WoW deltas)
 *   2) Four pacing dials (GMV / Spend / Orders / ROAS — MTD vs plan)
 *   3) Ranked channel table with anomaly flags
 *
 * No lens tabs, no narrative, no charts — exec-narrative and analytical
 * deep-dives live on /advanced.
 */
export function MainDashboard({
  panel,
  filters,
}: {
  panel: PanelRow[];
  filters: Filters;
}) {
  const evcPanel = applyEvc(panel, filters.evc);
  const filtered = filterPanel(evcPanel, filters);
  const kpis = aggKPIs(filtered);
  const story = computeWeeklyStory(evcPanel, filters.market);
  const pacing = computePacing(evcPanel, filters.market);

  // Per-channel aggregate + anomaly signal.
  const channelDeltaById = new Map(
    (story?.channelDeltas ?? []).map((c) => [c.id, c] as const),
  );
  const byChannel = new Map<string, { spend: number; gmv: number }>();
  filtered.forEach((r) => {
    const b = byChannel.get(r.channel) ?? { spend: 0, gmv: 0 };
    b.spend += r.spend_usd;
    b.gmv += r.ads_gmv_usd ?? 0;
    byChannel.set(r.channel, b);
  });
  const channelRows = sortByPriority(
    CHANNELS.filter((c) => c.group !== "organic").map((c) => ({
      ...c,
      spend: byChannel.get(c.id)?.spend ?? 0,
      gmv: byChannel.get(c.id)?.gmv ?? 0,
    })),
  );

  return (
    <div style={{ background: C.paper }}>
      {/* 1. KPI strip */}
      <section
        className="pad-responsive"
        style={{
          padding: "28px 32px",
          borderBottom: `1px solid ${C.rule}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.accent,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Campaign Overview
          </span>
          <span style={{ fontFamily: FONT.serif, fontSize: 13, color: C.ink2 }}>
            blended performance · {story ? `week of ${story.weeks.now[0]} → ${story.weeks.now[6]}` : "current window"}
          </span>
          <span style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.ink3,
              letterSpacing: "0.04em",
            }}
          >
            {filters.market === "all" ? "All SEA markets" : filters.market}
            {filters.evc && <span style={{ color: C.accent, marginLeft: 8 }}>· EVC ON</span>}
          </span>
        </div>

        <div
          className="cols-2-mobile"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            border: `1px solid ${C.rule}`,
          }}
        >
          <KPIBlock
            label="Platform GMV"
            value={fmtUSD(story?.blended.now.gmv ?? kpis.gmv)}
            delta={story?.blended.gmvDelta ?? null}
            sub="week-on-week"
          />
          <KPIBlock
            label="Working Spend"
            value={fmtUSD(story?.blended.now.spend ?? kpis.spend)}
            delta={story?.blended.spendDelta ?? null}
            sub="week-on-week"
          />
          <KPIBlock
            label={filters.evc ? "Blended ROAS (+EVC)" : "Blended ROAS"}
            value={(story?.blended.now.roas ?? kpis.roas).toFixed(2) + "×"}
            delta={story?.blended.roasDelta ?? null}
            sub="ads-attr / spend"
          />
          <KPIBlock
            last
            label="Orders"
            value={fmtNum(story?.blended.now.orders ?? kpis.orders)}
            delta={story?.blended.ordersDelta ?? null}
            sub="net of cancels"
          />
        </div>
      </section>

      {/* 2. Pacing dials */}
      <section
        className="pad-responsive"
        style={{
          padding: "28px 32px",
          borderBottom: `1px solid ${C.rule}`,
        }}
      >
        <SectionHead
          kicker="Pacing · April"
          title={`Day ${pacing.dayOfMonth}/30 · ${pacing.daysLeft} days left`}
          byline="MTD actuals vs plan with end-of-month forecast"
        />
        <div
          className="cols-2-mobile"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            border: `1px solid ${C.rule}`,
          }}
        >
          <PacingDial
            label="GMV"
            actual={pacing.gmv.actual}
            plan={pacing.gmv.plan}
            forecast={pacing.gmv.forecast}
            format={fmtUSD}
            daysLeft={pacing.daysLeft}
          />
          <PacingDial
            label="Spend"
            actual={pacing.spend.actual}
            plan={pacing.spend.plan}
            forecast={pacing.spend.forecast}
            format={fmtUSD}
            daysLeft={pacing.daysLeft}
          />
          <PacingDial
            label="Orders"
            actual={pacing.orders.actual}
            plan={pacing.orders.plan}
            forecast={pacing.orders.forecast}
            format={fmtNum}
            daysLeft={pacing.daysLeft}
          />
          <PacingDial
            label={filters.evc ? "Blended ROAS (+EVC)" : "Blended ROAS"}
            actual={pacing.roas.actual}
            plan={pacing.roas.plan}
            forecast={pacing.roas.forecast}
            format={(v) => v.toFixed(2) + "×"}
            daysLeft={pacing.daysLeft}
          />
        </div>
      </section>

      {/* 3. Ranked channel table with anomaly flags */}
      <section className="pad-responsive" style={{ padding: "28px 32px 48px" }}>
        <SectionHead
          kicker="Channels"
          title="Ranked performance, week-over-week"
          byline={`${channelRows.length} paid channels · sorted by priority`}
        >
          <a
            href="/advanced?tab=decisions"
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.ink,
              textDecoration: "none",
              border: `1px solid ${C.ink}`,
              padding: "5px 12px",
              display: "inline-block",
            }}
          >
            SEE RECOMMENDED MOVES →
          </a>
        </SectionHead>

        <div className="scroll-x-mobile">
          <table
            className="min-w-table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: FONT.mono,
              fontSize: 12,
            }}
          >
            <thead>
              <tr
                style={{
                  borderTop: `1.5px solid ${C.rule}`,
                  borderBottom: `1.5px solid ${C.rule}`,
                }}
              >
                {[
                  { h: "Channel", r: false },
                  { h: "Spend", r: true },
                  { h: "Attr GMV", r: true },
                  { h: "ROAS", r: true },
                  { h: "WoW Spend", r: true, hideMobile: true },
                  { h: "ROAS Δ", r: true, hideMobile: true },
                  { h: "Signal", r: false },
                ].map((c) => (
                  <th
                    key={c.h}
                    className={c.hideMobile ? "hide-mobile" : undefined}
                    style={{
                      textAlign: c.r ? "right" : "left",
                      padding: "10px 12px",
                      fontSize: 9,
                      color: C.ink3,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    {c.h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channelRows.map((r, i) => {
                const roas = r.spend > 0 ? r.gmv / r.spend : 0;
                const d = channelDeltaById.get(r.id);
                const anomaly = d ? computeAnomaly(d) : { level: "healthy" as const, label: "—" };
                const anomalyColor =
                  anomaly.level === "spike"
                    ? C.gold
                    : anomaly.level === "slump"
                      ? C.accent
                      : C.moss;
                const roasColor = roas > 1.4 ? C.moss : roas > 1.0 ? C.ink : C.accent;
                return (
                  <tr
                    key={r.id}
                    style={{ borderBottom: `1px solid ${C.ruleSoft}` }}
                  >
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            background: CHANNEL_COLOR[r.id] ?? C.ink,
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontFamily: FONT.serif,
                              fontSize: 14,
                              fontWeight: 500,
                              color: C.ink,
                            }}
                          >
                            {r.label}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: C.ink3,
                              letterSpacing: "0.04em",
                            }}
                          >
                            #{i + 1} · {r.platform}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: C.ink,
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 500,
                      }}
                    >
                      {fmtUSD(r.spend)}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: C.ink2,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtUSD(r.gmv)}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: roasColor,
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                      }}
                    >
                      {roas.toFixed(2)}×
                    </td>
                    <td
                      className="hide-mobile"
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: (d?.spendDelta ?? 0) >= 0 ? C.moss : C.accent,
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                      }}
                    >
                      {d?.spendDelta != null ? fmtDelta(d.spendDelta, 0) : "—"}
                    </td>
                    <td
                      className="hide-mobile"
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: (d?.roasShiftPct ?? 0) >= 0 ? C.moss : C.accent,
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                      }}
                    >
                      {d ? fmtDelta(d.roasShiftPct, 0) : "—"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        title={anomaly.label}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontFamily: FONT.mono,
                          fontSize: 10,
                          color: anomalyColor,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: anomalyColor,
                            flexShrink: 0,
                          }}
                        />
                        {anomaly.level === "healthy" ? "OK" : anomaly.level.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          className="flex-wrap-mobile"
          style={{
            marginTop: 24,
            paddingTop: 12,
            borderTop: `1px solid ${C.ruleSoft}`,
            fontFamily: FONT.mono,
            fontSize: 10,
            color: C.ink3,
            letterSpacing: "0.04em",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>
            Source: BigQuery ·{" "}
            {filters.evc
              ? "{project}.mart.daily_channel_panel_evc"
              : "{project}.mart.daily_channel_panel"}
          </span>
          <span>
            Need more context?{" "}
            <a
              href="/advanced?tab=narrative"
              style={{ color: C.accent, textDecoration: "underline" }}
            >
              Advanced views →
            </a>
          </span>
        </div>
      </section>
    </div>
  );
}

function KPIBlock({
  label,
  value,
  delta,
  sub,
  last,
}: {
  label: string;
  value: string;
  delta: number | null;
  sub: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: 20,
        borderRight: last ? "none" : `1px solid ${C.rule}`,
      }}
    >
      <KPI label={label} value={value} delta={delta} sub={sub} large />
    </div>
  );
}
