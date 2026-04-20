"use client";
import { useState } from "react";
import { C, CHANNEL_COLOR, FONT } from "@/lib/tokens";
import { SectionHead, Tag, ghostBtn } from "@/components/primitives";
import { ConnectedScatter } from "@/components/charts/connected-scatter";
import { Sparkline } from "@/components/charts/sparkline";
import { fmtDelta, fmtUSD } from "@/lib/format";
import { applyEvc, computeChannelTrend, computeWeeklyStory } from "@/lib/aggregations";
import { buildDecisionList, type Decision } from "@/lib/decisions";
import { CHANNELS } from "@/lib/taxonomy";
import type { Channel, Filters, PanelRow } from "@/lib/types";

export function DecisionsLens({
  panel,
  filters,
}: {
  panel: PanelRow[];
  filters: Filters;
}) {
  const evcPanel = applyEvc(panel, filters.evc);
  const story = computeWeeklyStory(evcPanel, filters.market);
  if (!story) return null;

  const moves = buildDecisionList(story);
  const defaultFocus = (moves[0]?.to ?? moves[0]?.from ?? "google_ads_shopee") as Channel;
  const [focused, setFocused] = useState<Channel>(defaultFocus);
  const channelTrend = computeChannelTrend(evcPanel, focused, filters.market);
  const channelLabel = CHANNELS.find((c) => c.id === focused)?.label ?? focused;

  return (
    <div
      className="pad-responsive"
      style={{ background: C.paper, padding: "24px 32px 48px" }}
    >
      {/* Header strip */}
      <div
        className="flex-wrap-mobile"
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
          Decisions · Week of {story.weeks.now[0]} → {story.weeks.now[6]}
        </span>
        <span
          style={{
            fontFamily: FONT.serif,
            fontSize: 13,
            color: C.ink2,
          }}
        >
          three reallocation moves, ranked by expected GMV impact
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT.mono, fontSize: 10, color: C.ink3 }}>
          based on 14-day trailing window ·{" "}
          {filters.market === "all" ? "All SEA" : filters.market}
        </span>
      </div>

      {/* The three decisions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 0,
          border: `1px solid ${C.rule}`,
          marginBottom: 28,
        }}
      >
        {moves.map((m, i) => (
          <DecisionCard
            key={i}
            idx={i + 1}
            move={m}
            isFocused={focused === m.from || focused === m.to}
            onFocus={setFocused}
          />
        ))}
      </div>

      {/* Evidence panel + watchlist */}
      <div
        className="stack-tablet"
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 24,
          paddingTop: 4,
        }}
      >
        <div>
          <SectionHead
            kicker="Evidence"
            title={channelLabel}
            byline="14-day spend × ROAS path · click any decision above to swap"
          />
          <div style={{ border: `1px solid ${C.rule}`, padding: 16, background: C.paper }}>
            <ConnectedScatter points={channelTrend} height={300} />
          </div>
          <p
            style={{
              marginTop: 14,
              fontFamily: FONT.serif,
              fontSize: 13,
              color: C.ink2,
              maxWidth: "60ch",
              lineHeight: 1.5,
            }}
          >
            Read top-right as healthy growth (more money, more return). Bottom-right
            is the warning quadrant: spend climbing, return falling — diminishing
            marginal ROAS, the textbook reallocation signal.
          </p>
        </div>

        <div>
          <SectionHead
            kicker="Watchlist"
            title="What didn't make the top three"
            byline="material movers held back by sample size or volatility"
          />
          <Watchlist story={story} onFocus={setFocused} />
        </div>
      </div>
    </div>
  );
}

function DecisionCard({
  idx,
  move,
  onFocus,
  isFocused,
}: {
  idx: number;
  move: Decision;
  onFocus: (c: Channel) => void;
  isFocused: boolean;
}) {
  const dotColor =
    move.conviction === "high" ? C.moss : move.conviction === "medium" ? C.gold : C.ink3;
  const actionTone =
    move.action === "shift" ? "accent" : move.action === "cut" ? "gold" : "moss";

  return (
    <div
      className="decision-card"
      style={{
        display: "grid",
        gridTemplateColumns: "88px minmax(0, 1fr) 300px 200px",
        borderBottom: `1px solid ${C.rule}`,
        background: isFocused ? C.paper2 : C.paper,
      }}
    >
      {/* Rank + conviction */}
      <div
        style={{
          padding: "20px 16px 20px 24px",
          borderRight: `1px solid ${C.ruleSoft}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(36px, 9vw, 56px)",
            fontWeight: 400,
            lineHeight: 0.85,
            color: C.ink,
            letterSpacing: "-0.04em",
          }}
        >
          {idx}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: FONT.mono,
            fontSize: 9,
            color: C.ink2,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <span
            style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }}
          />
          {move.conviction}
        </div>
      </div>

      {/* Hypothesis + evidence */}
      <div
        style={{
          padding: "18px 24px 18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minWidth: 0,
        }}
      >
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <Tag tone={actionTone}>{move.action.toUpperCase()}</Tag>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.ink3,
              letterSpacing: "0.06em",
            }}
          >
            {move.market === "all" ? "all markets" : move.market}
          </span>
        </div>
        <h3
          style={{
            margin: 0,
            fontFamily: FONT.serif,
            fontWeight: 500,
            fontSize: 21,
            lineHeight: 1.18,
            letterSpacing: "-0.01em",
          }}
        >
          {move.headline}
        </h3>
        <p
          style={{
            margin: 0,
            fontFamily: FONT.serif,
            fontSize: 13.5,
            color: C.ink2,
            lineHeight: 1.5,
            maxWidth: "60ch",
          }}
        >
          {move.because}
        </p>

        {/* Evidence table */}
        <div
          className="flex-wrap-mobile"
          style={{
            display: "inline-grid",
            gridAutoFlow: "column",
            gridAutoColumns: "min-content",
            marginTop: 4,
            border: `1px solid ${C.ruleSoft}`,
            background: C.paper,
            alignSelf: "flex-start",
          }}
        >
          {move.evidence.map((e, i) => (
            <button
              key={i}
              onClick={() => onFocus(e.channel)}
              style={{
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                border: "none",
                borderLeft: i > 0 ? `1px solid ${C.ruleSoft}` : "none",
                padding: "6px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                fontFamily: FONT.mono,
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 9,
                  color: C.ink3,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                <span
                  style={{ width: 6, height: 6, background: CHANNEL_COLOR[e.channel] ?? C.ink }}
                />
                {e.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: C.ink,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {e.value}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Mini-chart */}
      <div
        style={{
          padding: "18px 16px",
          borderLeft: `1px solid ${C.ruleSoft}`,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            color: C.ink3,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {move.chartLabel}
        </div>
        <DecisionMiniChart move={move} />
      </div>

      {/* Impact + actions */}
      <div
        style={{
          padding: "18px 22px 18px 18px",
          borderLeft: `1px solid ${C.ruleSoft}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              color: C.ink3,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Expected impact
          </div>
          <div
            style={{
              fontFamily: FONT.serif,
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1,
              marginTop: 4,
              color: move.impact >= 0 ? C.moss : C.accent,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
            }}
          >
            {move.impact >= 0 ? "+" : "−"}
            {fmtUSD(Math.abs(move.impact))}
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.ink3,
              marginTop: 4,
            }}
          >
            weekly GMV · {move.confidence}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            style={{
              ...ghostBtn,
              background: C.ink,
              color: C.paper,
              borderColor: C.ink,
              fontSize: 10,
              padding: "7px 12px",
              fontWeight: 700,
            }}
          >
            QUEUE FOR REVIEW
          </button>
          <button style={{ ...ghostBtn, fontSize: 9, padding: "5px 12px" }}>
            SNOOZE 7D
          </button>
        </div>
      </div>
    </div>
  );
}

function DecisionMiniChart({ move }: { move: Decision }) {
  if (move.chart.chartType === "compare-bars") {
    const max = Math.max(...move.chart.chartData.map((d) => Math.max(d.now, d.prior)));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
        {move.chart.chartData.map((d, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: FONT.mono,
                fontSize: 10,
              }}
            >
              <span
                style={{
                  color: C.ink2,
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: CHANNEL_COLOR[d.id as Channel] ?? C.ink,
                  }}
                />
                {d.label}
              </span>
              <span style={{ color: C.ink, fontWeight: 600 }}>{d.metric}</span>
            </div>
            <div
              style={{
                position: "relative",
                height: 8,
                background: C.paper2,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(d.prior / max) * 100}%`,
                  background: C.ink4,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(d.now / max) * 100}%`,
                  background: CHANNEL_COLOR[d.id as Channel] ?? C.ink,
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        ))}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            color: C.ink4,
            marginTop: 2,
          }}
        >
          ▓ this wk · ▒ prior wk
        </div>
      </div>
    );
  }
  // sparkline-pair
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {move.chart.chartData.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.ink2,
              width: 80,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                background: CHANNEL_COLOR[d.id] ?? C.ink,
                flexShrink: 0,
              }}
            />
            {d.label}
          </span>
          <Sparkline
            values={d.values}
            color={CHANNEL_COLOR[d.id] ?? C.ink}
            width={120}
            height={22}
            fill
          />
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.ink,
              fontWeight: 600,
            }}
          >
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Watchlist({
  story,
  onFocus,
}: {
  story: NonNullable<ReturnType<typeof computeWeeklyStory>>;
  onFocus: (c: Channel) => void;
}) {
  const items = story.channelDeltas
    .filter((c) => c.spendNow > 1500 && c.spendDelta != null)
    .slice(0, 7);
  return (
    <div style={{ border: `1px solid ${C.rule}`, background: C.paper }}>
      {items.map((c, i) => {
        const roasShift = c.roasNow - c.roasPrev;
        return (
          <button
            key={c.id}
            onClick={() => onFocus(c.id)}
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "14px 1fr auto auto",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              cursor: "pointer",
              background: "transparent",
              border: "none",
              borderBottom:
                i < items.length - 1 ? `1px solid ${C.ruleSoft}` : "none",
              textAlign: "left",
              fontFamily: FONT.mono,
              fontSize: 11,
              color: C.ink,
            }}
          >
            <span style={{ width: 8, height: 8, background: CHANNEL_COLOR[c.id] ?? C.ink }} />
            <span
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.label}
            </span>
            <span
              style={{
                color: (c.spendDelta ?? 0) >= 0 ? C.moss : C.accent,
                fontWeight: 700,
                minWidth: 56,
                textAlign: "right",
              }}
            >
              {fmtDelta(c.spendDelta, 0)}
            </span>
            <span
              style={{
                color: roasShift >= 0 ? C.moss : C.accent,
                fontWeight: 600,
                minWidth: 64,
                textAlign: "right",
              }}
            >
              ROAS {roasShift >= 0 ? "+" : "−"}
              {Math.abs(roasShift).toFixed(2)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
