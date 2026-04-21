import { C, CHANNEL_COLOR, FONT } from "@/lib/tokens";
import { SectionHead, Tag } from "@/components/primitives";
import { DualAxis } from "@/components/charts/dual-axis";
import { ShareComparison, type ShareRow } from "@/components/charts/share-comparison";
import { fmtDelta, fmtUSD } from "@/lib/format";
import {
  applyEvc,
  computeAnomaly,
  computeWeeklyStory,
  filterPanel,
} from "@/lib/aggregations";
import { CHANNELS, sortByPriority } from "@/lib/taxonomy";
import type { Filters, PanelRow } from "@/lib/types";

/**
 * `/daily-report` — the canonical measurement read from Charter §4.
 * Four sections:
 *   §4.1  Spend vs platform GMV (dual-axis, with promo overlay)
 *   §4.2  Share of spend vs share of GMV (divergence = saturation)
 *   §4.3  Reported ROAS by channel (direct + broad on Shopee; 7d_click
 *         on TT/Meta; all_conversions on Google)
 *   §4.4  Promo overlay legend (payday + mega-sale markers)
 */
export function DailyReport({
  panel,
  filters,
}: {
  panel: PanelRow[];
  filters: Filters;
}) {
  const evcPanel = applyEvc(panel, filters.evc);
  const filtered = filterPanel(evcPanel, filters);

  // ── §4.1 data: per-day GMV + stacked spend by top channel ──────
  const dates = [...new Set(filtered.map((r) => r.date))].sort();
  const gmvByDate = new Map<string, number>();
  const seen = new Set<string>();
  filtered.forEach((r) => {
    const k = `${r.date}|${r.market}|${r.platform}`;
    if (!seen.has(k)) {
      seen.add(k);
      gmvByDate.set(
        r.date,
        (gmvByDate.get(r.date) ?? 0) + (r.platform_total_gmv_usd ?? 0),
      );
    }
  });

  // Top 6 paid channels by total spend in the window — same bias as the
  // main-page channel ledger, so the viewer keeps one mental model.
  const paidChannels = sortByPriority(
    CHANNELS.filter((c) => c.group !== "organic"),
  );
  const spendByChannel = new Map<string, number>();
  filtered.forEach((r) => {
    spendByChannel.set(
      r.channel,
      (spendByChannel.get(r.channel) ?? 0) + r.spend_usd,
    );
  });
  const top6 = paidChannels
    .slice()
    .sort(
      (a, b) =>
        (spendByChannel.get(b.id) ?? 0) - (spendByChannel.get(a.id) ?? 0),
    )
    .slice(0, 6);

  const spendStack = top6.map((c) => ({
    label: c.label,
    color: CHANNEL_COLOR[c.id] ?? C.ink,
    values: dates.map((d) =>
      filtered
        .filter((r) => r.date === d && r.channel === c.id)
        .reduce((a, r) => a + r.spend_usd, 0),
    ),
  }));

  // Promo indices for the dual-axis overlay.
  const paydayIndices: number[] = [];
  const megaSaleIndices: { index: number; label: string }[] = [];
  dates.forEach((d, i) => {
    const sample = filtered.find((r) => r.date === d);
    if (sample?.is_payday) paydayIndices.push(i);
    if (sample?.is_mega_sale) {
      megaSaleIndices.push({ index: i, label: prettyMegaLabel(d) });
    }
  });

  // ── §4.2 data: share of spend vs share of GMV ──────────────────
  const totalSpend = [...spendByChannel.values()].reduce((a, b) => a + b, 0);
  const gmvByChannel = new Map<string, number>();
  filtered.forEach((r) => {
    gmvByChannel.set(
      r.channel,
      (gmvByChannel.get(r.channel) ?? 0) + (r.ads_gmv_usd ?? 0),
    );
  });
  const totalAttrGmv = [...gmvByChannel.values()].reduce((a, b) => a + b, 0);
  const shareRows: ShareRow[] = paidChannels
    .map((c) => ({
      id: c.id,
      label: c.label,
      color: CHANNEL_COLOR[c.id] ?? C.ink,
      spendShare: totalSpend > 0 ? (spendByChannel.get(c.id) ?? 0) / totalSpend : 0,
      gmvShare: totalAttrGmv > 0 ? (gmvByChannel.get(c.id) ?? 0) / totalAttrGmv : 0,
    }))
    .filter((r) => r.spendShare > 0.005 || r.gmvShare > 0.005);

  // ── §4.3 data: attribution-noted ROAS table ────────────────────
  const story = computeWeeklyStory(evcPanel, filters.market);
  const channelDeltaById = new Map(
    (story?.channelDeltas ?? []).map((c) => [c.id, c] as const),
  );
  const roasRows = paidChannels.map((c) => {
    const chRows = filtered.filter((r) => r.channel === c.id);
    const spend = chRows.reduce((a, r) => a + r.spend_usd, 0);
    const direct = chRows.reduce((a, r) => a + (r.direct_gmv_usd ?? 0), 0);
    const broad = chRows.reduce((a, r) => a + (r.broad_gmv_usd ?? 0), 0);
    const ads = chRows.reduce((a, r) => a + (r.ads_gmv_usd ?? 0), 0);
    const d = channelDeltaById.get(c.id);
    const anomaly = d
      ? computeAnomaly(d)
      : { level: "healthy" as const, label: "—" };
    return {
      id: c.id,
      label: c.label,
      platform: c.platform,
      spend,
      direct_roas: spend > 0 ? direct / spend : 0,
      broad_roas: spend > 0 ? broad / spend : 0,
      ads_roas: spend > 0 ? ads / spend : 0,
      anomaly,
    };
  });

  return (
    <div style={{ background: C.paper }}>
      {/* Header */}
      <section
        className="pad-responsive"
        style={{
          padding: "28px 32px 18px",
          borderBottom: `2px solid ${C.rule}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              fontWeight: 700,
              color: C.accent,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Daily Report · {dates[0]} → {dates[dates.length - 1]}
          </span>
          <span style={{ fontFamily: FONT.serif, fontSize: 13, color: C.ink2 }}>
            spend vs GMV · share divergence · ROAS by channel · promo overlay
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
            {filters.evc && (
              <span style={{ color: C.accent, marginLeft: 8 }}>· EVC ON</span>
            )}
          </span>
        </div>
      </section>

      {/* §4.1 Spend vs GMV */}
      <section
        className="pad-responsive"
        style={{
          padding: "28px 32px",
          borderBottom: `1px solid ${C.rule}`,
        }}
      >
        <SectionHead
          kicker="§4.1 Spend vs GMV"
          title="Daily spend against platform GMV"
          byline="Dual-axis: GMV on left (line), spend stacked by channel on right (columns). Payday + mega-sale rules overlay the timeline."
        />
        <div className="scroll-x-mobile">
          <div className="min-w-chart">
            <DualAxis
              height={300}
              xLabels={dates.map((d) => d.slice(5))}
              gmv={dates.map((d) => gmvByDate.get(d) ?? 0)}
              spendStack={spendStack}
              paydayIndices={paydayIndices}
              megaSaleIndices={megaSaleIndices}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 18,
            marginTop: 10,
            flexWrap: "wrap",
            fontFamily: FONT.mono,
            fontSize: 10,
            color: C.ink2,
          }}
        >
          <Legend swatch={<LineSwatch />} label="Platform GMV" />
          {spendStack.map((s) => (
            <Legend
              key={s.label}
              swatch={<BoxSwatch color={s.color} />}
              label={s.label}
            />
          ))}
        </div>
      </section>

      {/* §4.2 Share divergence */}
      <section
        className="pad-responsive"
        style={{
          padding: "28px 32px",
          borderBottom: `1px solid ${C.rule}`,
        }}
      >
        <SectionHead
          kicker="§4.2 Share divergence"
          title="Share of spend vs share of ads-attributed GMV"
          byline="Divergence is the saturation / reallocation signal — channels where spend share outpaces GMV share are over-funded for their yield."
        />
        <ShareComparison rows={shareRows} divergenceThreshold={0.05} />
      </section>

      {/* §4.3 Attribution-noted ROAS */}
      <section
        className="pad-responsive"
        style={{
          padding: "28px 32px",
          borderBottom: `1px solid ${C.rule}`,
        }}
      >
        <SectionHead
          kicker="§4.3 Attribution-noted ROAS"
          title="Reported ROAS by channel, with attribution window"
          byline="Shopee shows direct (last-click) and broad (direct + view-assisted) side-by-side. TikTok Ads / Meta CPAS report a 7d_click number. Google Ads reports all_conversions."
        />
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
                  { h: "Attribution", r: false },
                  { h: "Spend", r: true },
                  { h: "Direct ROAS", r: true },
                  { h: "Broad ROAS", r: true },
                  { h: "Signal", r: false },
                ].map((c) => (
                  <th
                    key={c.h}
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
              {roasRows.map((r, i) => {
                const isShopeeAd = r.id.startsWith("shopee_ads_");
                const attribution = isShopeeAd
                  ? "direct + broad"
                  : r.id === "google_ads_shopee"
                    ? "all_conversions"
                    : "7d_click";
                return (
                  <tr
                    key={r.id}
                    style={{ borderBottom: `1px solid ${C.ruleSoft}` }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            background: CHANNEL_COLOR[r.id] ?? C.ink,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: C.ink, fontWeight: 500 }}>
                          {r.label}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: C.ink3,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {r.platform}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <Tag
                        tone={
                          isShopeeAd
                            ? "gold"
                            : r.id === "google_ads_shopee"
                              ? "accent"
                              : "indigo"
                        }
                      >
                        {attribution}
                      </Tag>
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        color: C.ink,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtUSD(r.spend)}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: isShopeeAd ? C.ink2 : C.ink3,
                        fontWeight: 600,
                      }}
                    >
                      {r.direct_roas > 0 ? r.direct_roas.toFixed(2) + "×" : "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: r.broad_roas > 1.4 ? C.moss : r.broad_roas > 1.0 ? C.ink : C.accent,
                        fontWeight: 700,
                      }}
                    >
                      {r.broad_roas > 0 ? r.broad_roas.toFixed(2) + "×" : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {(() => {
                        const lvl = r.anomaly.level;
                        const color =
                          lvl === "data_issue"
                            ? C.gold
                            : lvl === "spike"
                              ? C.gold
                              : lvl === "slump"
                                ? C.accent
                                : C.moss;
                        const text =
                          lvl === "data_issue"
                            ? "⚠ VERIFY"
                            : lvl === "healthy"
                              ? "OK"
                              : lvl.toUpperCase();
                        return (
                          <span
                            title={r.anomaly.detail ?? r.anomaly.label}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontFamily: FONT.mono,
                              fontSize: 10,
                              color,
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
                                borderRadius: lvl === "data_issue" ? 0 : "50%",
                                background: color,
                                flexShrink: 0,
                              }}
                            />
                            {text}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: FONT.mono,
            fontSize: 10,
            color: C.ink3,
            lineHeight: 1.5,
          }}
        >
          Footnote: <strong style={{ color: C.ink2 }}>direct</strong> and{" "}
          <strong style={{ color: C.ink2 }}>broad</strong> diverge on Shopee because
          broad includes view-assisted conversions. Non-Shopee channels duplicate
          both columns (the single reported figure) — reading direct = broad is
          expected.
        </div>
      </section>

      {/* §4.4 Promo overlay legend */}
      <section
        className="pad-responsive"
        style={{ padding: "28px 32px 48px" }}
      >
        <SectionHead
          kicker="§4.4 Promo overlay"
          title="Payday + mega-sale markers in this window"
          byline="Markers are drawn directly on §4.1's GMV line — this panel is the legend and the narrative."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 0,
            border: `1px solid ${C.rule}`,
          }}
          className="stack-mobile"
        >
          <PromoBlock
            title="Payday"
            color={C.gold}
            lineStyle="2 3"
            description="Days-of-month 1, 15, 16 — the SEA payroll rhythm that lifts baseline demand for a day or two."
            hits={paydayIndices.length}
          />
          <PromoBlock
            title="Mega-sale"
            color={C.accent}
            lineStyle="4 3"
            description="Pan-SEA + market-specific events (11.11, 12.12, 9.9, 3.3, 4.4, Harbolnas, Lebaran, Songkran, Tet, CNY) per seeds.seed_calendar_events."
            hits={megaSaleIndices.length}
          />
        </div>

        {story && (
          <div
            style={{
              marginTop: 16,
              fontFamily: FONT.serif,
              fontSize: 13,
              color: C.ink2,
              lineHeight: 1.55,
              maxWidth: "72ch",
            }}
          >
            Platform GMV moved{" "}
            <strong
              style={{
                color: (story.blended.gmvDelta ?? 0) >= 0 ? C.moss : C.accent,
              }}
            >
              {fmtDelta(story.blended.gmvDelta ?? 0)}
            </strong>{" "}
            week-over-week on{" "}
            <strong style={{ color: C.ink }}>
              {fmtDelta(story.blended.spendDelta ?? 0)}
            </strong>{" "}
            spend. Read the §4.1 chart with the §4.4 markers in mind — mega-sale
            spikes without a payday overlap are the clean demand signal.
          </div>
        )}
      </section>
    </div>
  );
}

function Legend({
  swatch,
  label,
}: {
  swatch: React.ReactNode;
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        letterSpacing: "0.02em",
      }}
    >
      {swatch}
      {label}
    </span>
  );
}

function BoxSwatch({ color }: { color: string }) {
  return <span style={{ width: 10, height: 10, background: color, flexShrink: 0 }} />;
}

function LineSwatch() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 0,
        borderTop: `2px solid ${C.ink}`,
        verticalAlign: "middle",
      }}
    />
  );
}

function PromoBlock({
  title,
  color,
  lineStyle,
  description,
  hits,
}: {
  title: string;
  color: string;
  lineStyle: string;
  description: string;
  hits: number;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRight: `1px solid ${C.rule}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="36" height="10" style={{ flexShrink: 0 }}>
          <line
            x1="0"
            x2="36"
            y1="5"
            y2="5"
            stroke={color}
            strokeWidth="1.25"
            strokeDasharray={lineStyle}
          />
        </svg>
        <span
          style={{
            fontFamily: FONT.serif,
            fontSize: 16,
            fontWeight: 500,
            color: C.ink,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            color: C.ink3,
            letterSpacing: "0.04em",
          }}
        >
          · {hits} {hits === 1 ? "day" : "days"} in window
        </span>
      </div>
      <div
        style={{
          fontFamily: FONT.serif,
          fontSize: 13,
          color: C.ink2,
          lineHeight: 1.45,
        }}
      >
        {description}
      </div>
    </div>
  );
}

function prettyMegaLabel(iso: string): string {
  const mmdd = iso.slice(5); // "MM-DD"
  const [mm, dd] = mmdd.split("-");
  // 11-11 → "11.11", 03-20 → "3.20", etc.
  const m = parseInt(mm!, 10);
  const d = parseInt(dd!, 10);
  return `${m}.${d}`;
}
