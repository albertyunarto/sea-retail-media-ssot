"use client";
import { useMemo, useState } from "react";
import { C, CHANNEL_COLOR, FONT } from "@/lib/tokens";
import { KPI, SectionHead } from "@/components/primitives";
import { LineChart } from "@/components/charts/line-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { fmtDelta, fmtNum, fmtPct, fmtUSD } from "@/lib/format";
import { aggKPIs, applyEvc, filterPanel } from "@/lib/aggregations";
import { computeHeatmap } from "@/lib/heatmap";
import { CHANNELS, MARKETS, sortByPriority } from "@/lib/taxonomy";
import type { Channel, Filters, Market, PanelRow } from "@/lib/types";

export function ChannelBrief({
  panel,
  filters,
}: {
  panel: PanelRow[];
  filters: Filters;
}) {
  const [channelId, setChannelId] = useState<Channel>("google_ads_shopee");
  const paidChannels = useMemo(
    () => sortByPriority(CHANNELS.filter((c) => c.group !== "organic")),
    [],
  );

  const evcPanel = applyEvc(panel, filters.evc);
  const filtered = filterPanel(evcPanel, filters);
  const channelRows = filtered.filter((r) => r.channel === channelId);
  const prevRows = applyEvc(panel, filters.evc).filter((r) => {
    const days = filters.range === "mtd" ? 20 : parseInt(filters.range, 10);
    const from = new Date("2026-04-19");
    const end = new Date(from);
    end.setUTCDate(from.getUTCDate() - days);
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - days);
    const t = new Date(r.date).getTime();
    return (
      r.channel === channelId && t >= start.getTime() && t < end.getTime()
    );
  });

  const k = aggKPIs(channelRows);
  const kPrev = aggKPIs(prevRows);
  const adSpend = k.spend;
  const adGmv = k.adsGmv;
  const clicks = channelRows.reduce((a, r) => a + (r.clicks || 0), 0);
  const impressions = channelRows.reduce((a, r) => a + (r.impressions || 0), 0);
  const orders = channelRows.reduce((a, r) => a + (r.ads_orders || 0), 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cvr = clicks > 0 ? orders / clicks : 0;

  const ch = CHANNELS.find((c) => c.id === channelId)!;
  const channelColor = CHANNEL_COLOR[channelId] ?? C.ink;

  const dates = [...new Set(filtered.map((r) => r.date))].sort();
  const spendByDate = dates.map((d) =>
    channelRows.filter((r) => r.date === d).reduce((a, r) => a + r.spend_usd, 0),
  );
  const gmvByDate = dates.map((d) =>
    channelRows.filter((r) => r.date === d).reduce((a, r) => a + (r.ads_gmv_usd ?? 0), 0),
  );

  // Per-market breakdown
  const byMarket = MARKETS.map((m) => {
    const mr = channelRows.filter((r) => r.market === m.code);
    const mk = aggKPIs(mr);
    const trend = dates
      .slice(-14)
      .map((d) => mr.filter((r) => r.date === d).reduce((a, r) => a + r.spend_usd, 0));
    return { ...m, ...mk, trend };
  }).sort((a, b) => b.spend - a.spend);

  const heatmap = computeHeatmap(
    evcPanel,
    channelId,
    MARKETS.map((m) => m.code),
    21,
  );

  return (
    <div style={{ background: C.paper }}>
      {/* Header block */}
      <section
        style={{
          padding: "28px 32px 18px",
          borderBottom: `2px solid ${C.rule}`,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.accent,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ width: 10, height: 10, background: channelColor }} />
            Channel Brief
            <span style={{ color: C.ink3 }}>· {ch.platform}</span>
            <span style={{ color: C.ink3 }}>· {ch.group.replace("_", "-")}</span>
          </div>
          <ChannelDropdown
            channelId={channelId}
            onChange={setChannelId}
            channels={paidChannels.map((c) => ({ id: c.id, label: c.label }))}
          />
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.ink3,
              letterSpacing: "0.04em",
            }}
          >
            {filters.range === "mtd" ? "Month to date" : `Last ${filters.range} days`}
            {" · "}
            {filters.market === "all" ? "All SEA markets" : filters.market}
            {filters.evc && <span style={{ color: C.accent, marginLeft: 8 }}>· EVC ON</span>}
          </div>
        </div>
      </section>

      {/* 6-up KPI strip */}
      <section
        style={{
          padding: "24px 32px",
          borderBottom: `1px solid ${C.rule}`,
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 0,
          border: "none",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 0,
            border: `1px solid ${C.rule}`,
            gridColumn: "1 / -1",
          }}
        >
          <KPIBlock
            label="Spend"
            value={fmtUSD(adSpend)}
            delta={kPrev.spend > 0 ? (adSpend - kPrev.spend) / kPrev.spend : null}
          />
          <KPIBlock
            label={filters.evc ? "Attr GMV +EVC" : "Attr GMV"}
            value={fmtUSD(adGmv)}
            delta={kPrev.adsGmv > 0 ? (adGmv - kPrev.adsGmv) / kPrev.adsGmv : null}
          />
          <KPIBlock
            label="ROAS"
            value={(adSpend > 0 ? adGmv / adSpend : 0).toFixed(2) + "×"}
            delta={
              kPrev.spend > 0
                ? ((adGmv / adSpend - kPrev.adsGmv / kPrev.spend) /
                    (kPrev.adsGmv / kPrev.spend || 1))
                : null
            }
          />
          <KPIBlock
            label="Orders"
            value={fmtNum(orders)}
            delta={null}
          />
          <KPIBlock label="CTR" value={fmtPct(ctr, 2)} delta={null} />
          <KPIBlock label="CVR" value={fmtPct(cvr, 2)} delta={null} last />
        </div>
      </section>

      {/* Time series */}
      <section
        style={{
          padding: "24px 32px",
          borderBottom: `1px solid ${C.rule}`,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
        }}
      >
        <div>
          <SectionHead
            kicker="Daily"
            title="Spend trajectory"
            byline={`${dates.length} observations · filter bar window`}
          />
          <LineChart
            height={240}
            xLabels={dates.map((d) => d.slice(5))}
            series={[
              {
                label: "Spend",
                color: channelColor,
                values: spendByDate,
                weight: 2,
              },
            ]}
          />
        </div>
        <div>
          <SectionHead
            kicker="Daily"
            title="Attributed GMV"
            byline="ads-attributed · USD"
          />
          <LineChart
            height={240}
            xLabels={dates.map((d) => d.slice(5))}
            series={[
              {
                label: "GMV",
                color: C.ink,
                values: gmvByDate,
                weight: 2,
              },
            ]}
          />
        </div>
      </section>

      {/* Per-market breakdown */}
      <section
        style={{
          padding: "24px 32px",
          borderBottom: `1px solid ${C.rule}`,
        }}
      >
        <SectionHead
          kicker="By geography"
          title="Market breakdown"
          byline="sorted by spend"
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
          {byMarket.map((m) => (
            <article
              key={m.code}
              style={{
                padding: 18,
                borderRight: `1px solid ${C.rule}`,
                borderBottom: `1px solid ${C.rule}`,
                display: "flex",
                flexDirection: "column",
                gap: 8,
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
                      fontSize: 24,
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
                    {m.name}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    color: C.ink3,
                  }}
                >
                  {m.currency}
                </span>
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
                <Stat label="Spend" value={fmtUSD(m.spend)} />
                <Stat label="Attr GMV" value={fmtUSD(m.adsGmv)} />
                <Stat
                  label="ROAS"
                  value={(m.spend > 0 ? m.adsGmv / m.spend : 0).toFixed(2) + "×"}
                  accent={
                    m.spend > 0 && m.adsGmv / m.spend > 1.3
                      ? C.moss
                      : m.spend > 0 && m.adsGmv / m.spend < 1.0
                        ? C.accent
                        : C.ink
                  }
                />
              </div>
              <Sparkline values={m.trend} color={channelColor} width={260} height={24} fill />
            </article>
          ))}
        </div>
      </section>

      {/* Market × Day Heatmap */}
      <section style={{ padding: "24px 32px 48px" }}>
        <SectionHead
          kicker="Pattern"
          title="Market × day spend heatmap"
          byline="last 21 days · lighter = lower spend, darker = heavier spend"
        />
        <Heatmap data={heatmap} channelColor={channelColor} />
        <div
          style={{
            marginTop: 20,
            fontFamily: FONT.mono,
            fontSize: 10,
            color: C.ink3,
            letterSpacing: "0.04em",
          }}
        >
          Source: BigQuery ·{" "}
          {filters.evc
            ? "{project}.mart.daily_channel_panel_evc"
            : "{project}.mart.daily_channel_panel"}{" "}
          · channel = {channelId}
        </div>
      </section>
    </div>
  );
}

function KPIBlock({
  label,
  value,
  delta,
  last,
}: {
  label: string;
  value: string;
  delta: number | null;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRight: last ? "none" : `1px solid ${C.rule}`,
      }}
    >
      <KPI label={label} value={value} delta={delta} />
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
          fontSize: 16,
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

function ChannelDropdown({
  channelId,
  onChange,
  channels,
}: {
  channelId: Channel;
  onChange: (c: Channel) => void;
  channels: { id: Channel; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const current = channels.find((c) => c.id === channelId);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "baseline",
          gap: 10,
          color: C.ink,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: FONT.serif,
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "-0.025em",
            lineHeight: 1,
          }}
        >
          {current?.label ?? channelId}
        </h1>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 14,
            color: C.accent,
            fontWeight: 700,
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: C.paper,
            border: `1px solid ${C.rule}`,
            minWidth: 280,
            zIndex: 10,
            boxShadow: "0 6px 16px rgba(11,18,32,0.08)",
          }}
        >
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "10px 1fr",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                width: "100%",
                textAlign: "left",
                border: "none",
                background: c.id === channelId ? C.paper2 : "transparent",
                fontFamily: FONT.mono,
                fontSize: 12,
                fontWeight: c.id === channelId ? 700 : 500,
                color: C.ink,
                cursor: "pointer",
              }}
            >
              <span style={{ width: 10, height: 10, background: CHANNEL_COLOR[c.id] ?? C.ink }} />
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Heatmap({
  data,
  channelColor,
}: {
  data: { markets: Market[]; dates: string[]; cells: Record<string, number>; max: number };
  channelColor: string;
}) {
  const cellW = 28;
  const cellH = 22;
  const gap = 1;
  return (
    <div
      style={{
        border: `1px solid ${C.rule}`,
        background: C.paper,
        padding: 12,
        overflow: "auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `64px repeat(${data.dates.length}, ${cellW}px)`,
          gap,
        }}
      >
        <div />
        {data.dates.map((d) => (
          <div
            key={d}
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              color: C.ink3,
              textAlign: "center",
              letterSpacing: "0.04em",
            }}
          >
            {d.slice(8)}
          </div>
        ))}
        {data.markets.map((m) => (
          <Row key={m} market={m} data={data} channelColor={channelColor} cellW={cellW} cellH={cellH} />
        ))}
      </div>
      <div
        style={{
          marginTop: 12,
          fontFamily: FONT.mono,
          fontSize: 9,
          color: C.ink3,
          display: "flex",
          alignItems: "center",
          gap: 8,
          letterSpacing: "0.04em",
        }}
      >
        SPEND: low
        <div
          style={{
            display: "flex",
          }}
        >
          {[0.1, 0.25, 0.5, 0.75, 1.0].map((t, i) => (
            <div
              key={i}
              style={{
                width: 20,
                height: 10,
                background: heatColor(channelColor, t),
              }}
            />
          ))}
        </div>
        high
      </div>
    </div>
  );
}

function Row({
  market,
  data,
  channelColor,
  cellW,
  cellH,
}: {
  market: Market;
  data: { dates: string[]; cells: Record<string, number>; max: number };
  channelColor: string;
  cellW: number;
  cellH: number;
}) {
  return (
    <>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
          color: C.ink,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          letterSpacing: "0.04em",
        }}
      >
        {market}
      </div>
      {data.dates.map((d) => {
        const v = data.cells[`${market}|${d}`] ?? 0;
        const t = data.max > 0 ? v / data.max : 0;
        return (
          <div
            key={`${market}|${d}`}
            title={`${market} · ${d} · ${fmtUSD(v)}`}
            style={{
              width: cellW,
              height: cellH,
              background: heatColor(channelColor, t),
            }}
          />
        );
      })}
    </>
  );
}

function heatColor(base: string, t: number): string {
  // Interpolate from paper2 (faint) to the channel color at t=1.
  // Parse the base color as #RRGGBB.
  const hex = base.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // paper2 = #EEF2F7
  const tMin = 0.08;
  const ease = tMin + t * (1 - tMin);
  const rr = Math.round(238 * (1 - ease) + r * ease);
  const gg = Math.round(242 * (1 - ease) + g * ease);
  const bb = Math.round(247 * (1 - ease) + b * ease);
  return `rgb(${rr}, ${gg}, ${bb})`;
}
