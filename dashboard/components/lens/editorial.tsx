import { C, FONT, CHANNEL_COLOR } from "@/lib/tokens";
import { KPI, SectionHead, Tag, ghostBtn } from "@/components/primitives";
import { LineChart } from "@/components/charts/line-chart";
import { StackedColumns } from "@/components/charts/stacked-columns";
import { Sparkline } from "@/components/charts/sparkline";
import { fmtDelta, fmtNum, fmtUSD } from "@/lib/format";
import { CHANNELS, MARKETS, sortByPriority } from "@/lib/taxonomy";
import { aggKPIs, applyEvc, computeWeeklyStory, filterPanel } from "@/lib/aggregations";
import type { Filters, PanelRow } from "@/lib/types";

export function EditorialLens({
  panel,
  filters,
}: {
  panel: PanelRow[];
  filters: Filters;
}) {
  const filtered = applyEvc(filterPanel(panel, filters), filters.evc);
  const kpis = aggKPIs(filtered);
  const story = computeWeeklyStory(applyEvc(panel, filters.evc), filters.market);

  // Channel rollup for the ranking table — sorted by priority so Shopee Ads
  // sub-channels lead, followed by Google, then Meta, then TikTok.
  const byChannel = new Map<string, { spend: number; gmv: number }>();
  filtered.forEach((r) => {
    const b = byChannel.get(r.channel) ?? { spend: 0, gmv: 0 };
    b.spend += r.spend_usd;
    b.gmv += r.ads_gmv_usd ?? 0;
    byChannel.set(r.channel, b);
  });
  const channelRows = sortByPriority(
    CHANNELS.map((c) => ({
      ...c,
      spend: byChannel.get(c.id)?.spend ?? 0,
      gmv: byChannel.get(c.id)?.gmv ?? 0,
    })),
  );

  // Top 6 channels for stacked column (cap at actual paid channels with spend).
  const top6 = [...channelRows].sort((a, b) => b.spend - a.spend).slice(0, 6);
  const dates = [...new Set(filtered.map((r) => r.date))].sort();
  const stack = dates.map((d) => ({
    label: d.slice(8),
    values: top6.map((c) =>
      filtered
        .filter((r) => r.date === d && r.channel === c.id)
        .reduce((a, r) => a + r.spend_usd, 0),
    ),
  }));
  const stackChannels = top6.map((c) => ({
    color: CHANNEL_COLOR[c.id] ?? C.ink,
    label: c.label,
  }));

  const gmvByDate = new Map<string, number>();
  const spendByDate = new Map<string, number>();
  const seen = new Set<string>();
  filtered.forEach((r) => {
    spendByDate.set(r.date, (spendByDate.get(r.date) ?? 0) + r.spend_usd);
    const k = `${r.date}|${r.market}|${r.platform}`;
    if (!seen.has(k)) {
      seen.add(k);
      gmvByDate.set(
        r.date,
        (gmvByDate.get(r.date) ?? 0) + (r.platform_total_gmv_usd ?? 0),
      );
    }
  });

  // Markets — sorted by GMV, lead at top
  const byMarket = MARKETS.map((m) => {
    const mrows = filtered.filter((r) => r.market === m.code);
    const k = aggKPIs(mrows);
    const trend = dates
      .slice(-14)
      .map((d) =>
        mrows.filter((r) => r.date === d).reduce((a, r) => a + (r.platform_total_gmv_usd ?? 0) / 11, 0),
      );
    return { ...m, ...k, trend };
  }).sort((a, b) => b.gmv - a.gmv);

  return (
    <div style={{ background: C.paper }}>
      {/* Lead story */}
      <section
        style={{
          padding: "32px 32px 24px",
          borderBottom: `2px double ${C.rule}`,
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 32,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.accent,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span>◆ Lead Story</span>
            <span style={{ color: C.ink3 }}>·</span>
            <span style={{ color: C.ink3 }}>
              Week of {story?.weeks.now[0]} → {story?.weeks.now[6]}
            </span>
            <span style={{ color: C.ink3 }}>·</span>
            <span style={{ color: C.ink3 }}>
              {filters.market === "all" ? "6 markets" : filters.market}
            </span>
          </div>

          <h2
            style={{
              margin: 0,
              fontFamily: FONT.serif,
              fontWeight: 500,
              fontSize: 56,
              lineHeight: 0.96,
              letterSpacing: "-0.025em",
              textWrap: "balance" as "balance",
            }}
          >
            Google Ads → Shopee{" "}
            <span style={{ color: C.accent, fontWeight: 400 }}>anchors</span> the week;
            Shopee Ads holds the wallet.
          </h2>

          <p
            style={{
              marginTop: 16,
              marginBottom: 0,
              fontFamily: FONT.serif,
              fontSize: 15,
              lineHeight: 1.5,
              color: C.ink2,
              maxWidth: "52ch",
            }}
          >
            Blended platform GMV closed at {fmtUSD(story?.blended.now.gmv ?? kpis.gmv)}{" "}
            against {fmtUSD(story?.blended.now.spend ?? kpis.spend)} of working spend.
            Google Ads delivered the highest single-channel ROAS at the hero band,
            while Shopee Ads sub-channels combined carry the largest share of wallet.
            Meta CPAS stayed efficient in third; TikTok Ads remained a small, sub-1×
            line item.
          </p>

          {/* Three editorial beats */}
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 0,
              borderTop: `1px solid ${C.rule}`,
              borderLeft: `1px solid ${C.rule}`,
            }}
          >
            {[
              {
                kicker: "MOVE",
                color: C.accent,
                text: story?.topMover
                  ? `${story.topMover.label} spend moved ${fmtDelta(story.topMover.spendDelta, 1)} WoW to ${fmtUSD(story.topMover.spendNow)}.`
                  : "—",
              },
              {
                kicker: "GEO",
                color: C.indigo,
                text: story?.leadMarket
                  ? `${story.leadMarket.code} led platform GMV at ${fmtUSD(story.leadMarket.gmvNow)}, ${fmtDelta(story.leadMarket.gmvDelta)} WoW.`
                  : "—",
              },
              {
                kicker: "WATCH",
                color: C.gold,
                text: story?.topRoasShift
                  ? `${story.topRoasShift.label} ROAS shifted to ${story.topRoasShift.roasNow.toFixed(2)}× (${fmtDelta(story.topRoasShift.roasShiftPct, 0)}).`
                  : "—",
              },
            ].map((b, i) => (
              <div
                key={i}
                style={{
                  padding: "12px 14px",
                  borderRight: `1px solid ${C.rule}`,
                  borderBottom: `1px solid ${C.rule}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minHeight: 78,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    color: b.color,
                  }}
                >
                  {b.kicker}
                </span>
                <span
                  style={{
                    fontFamily: FONT.serif,
                    fontSize: 13,
                    lineHeight: 1.35,
                    color: C.ink,
                  }}
                >
                  {b.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero KPIs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 0,
            border: `1px solid ${C.rule}`,
            alignSelf: "flex-start",
          }}
        >
          <div
            style={{
              padding: 20,
              borderRight: `1px solid ${C.rule}`,
              borderBottom: `1px solid ${C.rule}`,
            }}
          >
            <KPI
              label="Platform GMV"
              value={fmtUSD(story?.blended.now.gmv ?? kpis.gmv)}
              delta={story?.blended.gmvDelta}
              sub="week-on-week"
              large
            />
          </div>
          <div
            style={{
              padding: 20,
              borderBottom: `1px solid ${C.rule}`,
            }}
          >
            <KPI
              label="Working Spend"
              value={fmtUSD(story?.blended.now.spend ?? kpis.spend)}
              delta={story?.blended.spendDelta}
              sub="week-on-week"
              large
            />
          </div>
          <div style={{ padding: 20, borderRight: `1px solid ${C.rule}` }}>
            <KPI
              label={filters.evc ? "Blended ROAS (+EVC)" : "Blended ROAS"}
              value={(story?.blended.now.roas ?? kpis.roas).toFixed(2) + "×"}
              delta={story?.blended.roasDelta}
              sub="ads-attr / spend"
            />
          </div>
          <div style={{ padding: 20 }}>
            <KPI
              label="Orders"
              value={fmtNum(story?.blended.now.orders ?? kpis.orders)}
              delta={story?.blended.ordersDelta}
              sub="net of cancels"
            />
          </div>
        </div>
      </section>

      {/* Chart row */}
      <section
        style={{
          padding: "28px 32px",
          borderBottom: `1px solid ${C.rule}`,
          display: "grid",
          gridTemplateColumns: "1.7fr 1fr",
          gap: 32,
        }}
      >
        <div>
          <SectionHead
            kicker="Section A · Demand vs investment"
            title="GMV against working spend"
            byline={`Daily · USD · ${dates.length} observations · platform totals de-duplicated`}
          />
          <LineChart
            height={260}
            xLabels={dates.map((d) => d.slice(5))}
            series={[
              {
                label: "GMV",
                color: C.ink,
                values: dates.map((d) => gmvByDate.get(d) ?? 0),
                weight: 2,
              },
              {
                label: "Spend",
                color: C.accent,
                values: dates.map((d) => spendByDate.get(d) ?? 0),
                weight: 1.5,
                dashed: true,
              },
            ]}
          />
          <div
            style={{
              display: "flex",
              gap: 24,
              marginTop: 8,
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.ink2,
              letterSpacing: "0.04em",
            }}
          >
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 2,
                  background: C.ink,
                  marginRight: 6,
                  verticalAlign: "middle",
                }}
              />
              GMV — net of cancels &amp; refunds
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 0,
                  borderTop: `2px dashed ${C.accent}`,
                  marginRight: 6,
                  verticalAlign: "middle",
                }}
              />
              SPEND — voucher-funded excluded
            </span>
          </div>
        </div>

        <div>
          <SectionHead
            kicker="Section B · Channel mix"
            title="Daily spend, top six"
            byline="Stacked · USD · sorted by total spend"
          />
          <StackedColumns days={stack} channels={stackChannels} height={260} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "4px 16px",
              marginTop: 10,
            }}
          >
            {stackChannels.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  color: C.ink2,
                  letterSpacing: "0.02em",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: c.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.label.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Markets */}
      <section style={{ padding: "28px 32px", borderBottom: `1px solid ${C.rule}` }}>
        <SectionHead
          kicker="Section C · By geography"
          title="Markets at a glance"
          byline={`${MARKETS.length} territories · sorted by GMV`}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 0,
            borderTop: `1px solid ${C.rule}`,
            borderLeft: `1px solid ${C.rule}`,
          }}
        >
          {byMarket.map((m, i) => (
            <article
              key={m.code}
              style={{
                padding: 20,
                borderRight: `1px solid ${C.rule}`,
                borderBottom: `1px solid ${C.rule}`,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: i === 0 ? "rgba(37,99,235,0.04)" : "transparent",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: FONT.serif,
                      fontSize: 28,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {m.code}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      color: C.ink3,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {m.name} · {m.currency}
                  </span>
                </div>
                {i === 0 && <Tag tone="accent">LEAD</Tag>}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                  paddingTop: 4,
                  borderTop: `1px solid ${C.ruleSoft}`,
                }}
              >
                <Stat label="GMV" value={fmtUSD(m.gmv)} />
                <Stat label="Spend" value={fmtUSD(m.spend)} />
                <Stat
                  label="ROAS"
                  value={m.roas.toFixed(2) + "×"}
                  accent={m.roas > 4 ? C.moss : m.roas > 2 ? C.ink : C.accent}
                />
              </div>
              <Sparkline values={m.trend} color={C.ink} width={280} height={28} fill />
            </article>
          ))}
        </div>
      </section>

      {/* Channel ledger */}
      <section style={{ padding: "28px 32px 48px" }}>
        <SectionHead
          kicker="Section D · The ledger"
          title="Channel performance, ranked"
          byline={`${CHANNELS.length} channels · sorted by priority / wallet share`}
        >
          <a href="/channel" style={{ textDecoration: "none" }}>
            <button style={ghostBtn}>DEEP-DIVE →</button>
          </a>
        </SectionHead>

        <table
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
                borderBottom: `1.5px solid ${C.rule}`,
                borderTop: `1.5px solid ${C.rule}`,
              }}
            >
              {["Rank", "Channel", "Platform", "Group", "Spend", "Ads-attr GMV", "ROAS", "%share"].map(
                (h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i >= 4 ? "right" : "left",
                      padding: "10px 12px",
                      fontSize: 9,
                      color: C.ink3,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {channelRows.map((r, i) => {
              const roas = r.spend > 0 ? r.gmv / r.spend : 0;
              const share = kpis.spend > 0 ? (r.spend / kpis.spend) * 100 : 0;
              const roasColor =
                r.group === "organic"
                  ? C.ink3
                  : roas > 1.4
                    ? C.moss
                    : roas > 1.0
                      ? C.ink
                      : C.accent;
              return (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: `1px solid ${C.ruleSoft}`,
                  }}
                >
                  <td
                    style={{
                      padding: "12px",
                      color: C.ink3,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
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
                          {r.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      color: C.ink2,
                      fontSize: 11,
                    }}
                  >
                    {r.platform}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <Tag
                      tone={
                        r.group === "organic"
                          ? "moss"
                          : r.group === "on_platform"
                            ? "gold"
                            : "indigo"
                      }
                    >
                      {r.group.replace("_", "-")}
                    </Tag>
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
                    {r.group === "organic" ? "—" : fmtUSD(r.spend)}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      color: C.ink2,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {r.group === "organic" ? "—" : fmtUSD(r.gmv)}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color: roasColor,
                    }}
                  >
                    {r.group === "organic" ? "—" : roas.toFixed(2) + "×"}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      textAlign: "right",
                    }}
                  >
                    {r.group === "organic" ? (
                      <span style={{ color: C.ink3 }}>—</span>
                    ) : (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            color: C.ink2,
                            fontSize: 11,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {share.toFixed(1)}%
                        </span>
                        <div
                          style={{
                            width: 60,
                            height: 6,
                            background: C.paper2,
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: share + "%",
                              background: CHANNEL_COLOR[r.id] ?? C.ink,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div
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
          }}
        >
          <span>
            Source: BigQuery ·{" "}
            {filters.evc
              ? "{project}.mart.daily_channel_panel_evc"
              : "{project}.mart.daily_channel_panel"}{" "}
            · grain: date_local × market × channel
          </span>
          <span>Days T−0 … T−13 are provisional. Treat T−14+ as final per runbook.</span>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 9,
          color: C.ink3,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT.serif,
          fontSize: 18,
          fontWeight: 500,
          color: accent ?? C.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
