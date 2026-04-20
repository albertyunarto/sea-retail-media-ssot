"use client";
import { useMemo } from "react";
import { C, CHANNEL_COLOR, FONT } from "@/lib/tokens";
import { SectionHead } from "@/components/primitives";
import { PacingDial } from "@/components/charts/pacing-dial";
import { SmallMultiples } from "@/components/charts/small-multiples";
import { fmtDelta, fmtNum, fmtUSD } from "@/lib/format";
import { applyEvc } from "@/lib/aggregations";
import { computePacing, computeSmallMultiples } from "@/lib/pacing";
import type { Filters, PanelRow } from "@/lib/types";

export function PacingLens({
  panel,
  filters,
}: {
  panel: PanelRow[];
  filters: Filters;
}) {
  const evcPanel = applyEvc(panel, filters.evc);
  const data = useMemo(() => computePacing(evcPanel, filters.market), [evcPanel, filters.market]);
  const sm = useMemo(
    () => computeSmallMultiples(evcPanel, filters.market),
    [evcPanel, filters.market],
  );

  return (
    <div style={{ background: C.paper, padding: "24px 32px 48px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          paddingBottom: 12,
          borderBottom: `2px solid ${C.rule}`,
          marginBottom: 20,
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
          Pacing · Month of April · day {data.dayOfMonth}/30
        </span>
        <span style={{ fontFamily: FONT.serif, fontSize: 13, color: C.ink2 }}>
          run-rate vs plan, with end-of-month forecast
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: C.ink3 }}>
          {data.daysLeft} days left · forecast = MTD × 30 / day_of_month
        </span>
      </div>

      {/* Pacing dials */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0,
          border: `1px solid ${C.rule}`,
          marginBottom: 28,
        }}
      >
        <PacingDial
          label="GMV"
          actual={data.gmv.actual}
          plan={data.gmv.plan}
          forecast={data.gmv.forecast}
          format={fmtUSD}
          daysLeft={data.daysLeft}
        />
        <PacingDial
          label="Spend"
          actual={data.spend.actual}
          plan={data.spend.plan}
          forecast={data.spend.forecast}
          format={fmtUSD}
          daysLeft={data.daysLeft}
        />
        <PacingDial
          label="Orders"
          actual={data.orders.actual}
          plan={data.orders.plan}
          forecast={data.orders.forecast}
          format={fmtNum}
          daysLeft={data.daysLeft}
        />
        <PacingDial
          label={filters.evc ? "Blended ROAS (+EVC)" : "Blended ROAS"}
          actual={data.roas.actual}
          plan={data.roas.plan}
          forecast={data.roas.forecast}
          format={(v) => v.toFixed(2) + "×"}
          daysLeft={data.daysLeft}
        />
      </div>

      {/* Channel pacing */}
      <div style={{ marginBottom: 28 }}>
        <SectionHead
          kicker="By channel"
          title="Where we'll land"
          byline="MTD spend vs allotted plan, with end-of-month forecast and gap"
        />
        <ChannelPacingTable rows={data.byChannel} />
      </div>

      {/* Small multiples */}
      <div>
        <SectionHead
          kicker="Outliers"
          title="Channel × Market trajectory grid"
          byline="14-day spend trend per cell · scan for spikes, dips, anomalies"
        />
        <SmallMultiples
          rows={sm.rows}
          cols={sm.cols}
          cells={sm.cells}
          valueLabel={(v) => fmtUSD(v)}
        />
        <p
          style={{
            marginTop: 12,
            fontFamily: FONT.serif,
            fontSize: 12.5,
            color: C.ink2,
            maxWidth: "72ch",
            lineHeight: 1.5,
          }}
        >
          The same chart, repeated. Your eye picks up the cell that breaks pattern
          faster than any callout could — that's the point of the grid.
        </p>
      </div>
    </div>
  );
}

function ChannelPacingTable({
  rows,
}: {
  rows: { id: string; label: string; actual: number; plan: number; forecast: number }[];
}) {
  return (
    <div
      style={{
        border: `1px solid ${C.rule}`,
        background: C.paper,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 100px 100px 1.4fr 100px 80px",
          background: C.paper2,
          borderBottom: `1px solid ${C.rule}`,
          padding: "8px 14px",
          fontFamily: FONT.mono,
          fontSize: 9,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: C.ink3,
          fontWeight: 600,
        }}
      >
        <span>Channel</span>
        <span style={{ textAlign: "right" }}>MTD spend</span>
        <span style={{ textAlign: "right" }}>Plan</span>
        <span>Pacing</span>
        <span style={{ textAlign: "right" }}>Forecast</span>
        <span style={{ textAlign: "right" }}>Status</span>
      </div>
      {rows.map((r, i) => {
        const pct = r.actual / Math.max(r.plan, 1);
        const fpct = r.forecast / Math.max(r.plan, 1);
        const status = fpct < 0.95 ? "behind" : fpct > 1.05 ? "over" : "on";
        const statusColor = status === "on" ? C.moss : status === "behind" ? C.accent : C.gold;
        return (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 100px 100px 1.4fr 100px 80px",
              padding: "10px 14px",
              alignItems: "center",
              borderBottom: i < rows.length - 1 ? `1px solid ${C.ruleSoft}` : "none",
              fontFamily: FONT.mono,
              fontSize: 12,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: C.ink,
              }}
            >
              <span style={{ width: 10, height: 10, background: CHANNEL_COLOR[r.id] ?? C.ink }} />
              {r.label}
            </span>
            <span style={{ textAlign: "right", color: C.ink, fontVariantNumeric: "tabular-nums" }}>
              {fmtUSD(r.actual)}
            </span>
            <span
              style={{ textAlign: "right", color: C.ink3, fontVariantNumeric: "tabular-nums" }}
            >
              {fmtUSD(r.plan)}
            </span>
            <div style={{ position: "relative", height: 10, background: C.paper2 }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(Math.min(pct, 1.2) * 100) / 1.2}%`,
                  background: statusColor,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(Math.min(fpct, 1.2) * 100) / 1.2}%`,
                  background: statusColor,
                  opacity: 0.3,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${100 / 1.2}%`,
                  top: -2,
                  bottom: -2,
                  width: 1,
                  background: C.ink,
                }}
              />
            </div>
            <span
              style={{
                textAlign: "right",
                color: C.ink,
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
              }}
            >
              {fmtUSD(r.forecast)}
            </span>
            <span
              style={{
                textAlign: "right",
                color: statusColor,
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              {fmtDelta((r.forecast - r.plan) / r.plan, 0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
