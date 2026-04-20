"use client";
import { useMemo, useState } from "react";
import { C, FONT } from "@/lib/tokens";
import { SectionHead } from "@/components/primitives";
import { Waterfall } from "@/components/charts/waterfall";
import { LeverBridge } from "@/components/charts/lever-bridge";
import { Marimekko } from "@/components/charts/marimekko";
import { fmtDelta } from "@/lib/format";
import { applyEvc, computeWeeklyStory } from "@/lib/aggregations";
import {
  buildLevers,
  buildMarimekkoItems,
  buildWaterfallItems,
} from "@/lib/decomposition";
import { CHANNELS, sortByPriority } from "@/lib/taxonomy";
import type { Channel, Filters, PanelRow } from "@/lib/types";

export function DecompositionLens({
  panel,
  filters,
}: {
  panel: PanelRow[];
  filters: Filters;
}) {
  const evcPanel = applyEvc(panel, filters.evc);
  const story = useMemo(
    () => computeWeeklyStory(evcPanel, filters.market),
    [evcPanel, filters.market],
  );
  const [focused, setFocused] = useState<Channel>("google_ads_shopee");

  if (!story) return null;

  const waterfallItems = buildWaterfallItems(story);
  const levers = buildLevers(evcPanel, focused, filters.market);
  const mosaicItems = buildMarimekkoItems(story);
  const focusedLabel = CHANNELS.find((c) => c.id === focused)?.label ?? focused;
  const paidChannels = sortByPriority(CHANNELS.filter((c) => c.group !== "organic"));
  const gmvDelta = story.blended.gmvDelta ?? 0;

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
          Decomposition · Week of {story.weeks.now[0]} → {story.weeks.now[6]}
        </span>
        <span
          style={{
            fontFamily: FONT.serif,
            fontSize: 13,
            color: C.ink2,
          }}
        >
          which channel built it, which lever moved it
        </span>
      </div>

      {/* Waterfall */}
      <div style={{ marginBottom: 28 }}>
        <SectionHead
          kicker="Build vs. erode"
          title={
            <span>
              GMV moved{" "}
              <span style={{ color: gmvDelta >= 0 ? C.moss : C.accent }}>
                {fmtDelta(gmvDelta, 1)}
              </span>{" "}
              week-over-week
            </span>
          }
          byline="contribution to platform GMV Δ, by channel"
        />
        <div
          style={{
            border: `1px solid ${C.rule}`,
            padding: "12px 12px 4px",
            background: C.paper,
          }}
        >
          <Waterfall items={waterfallItems} height={260} />
        </div>
      </div>

      {/* Lever bridge */}
      <div style={{ marginBottom: 28 }}>
        <SectionHead
          kicker="Levers"
          title={<span>How {focusedLabel} got there</span>}
          byline="GMV = impressions × CTR × CVR × AOV — each lever's contribution, isolated"
        >
          <ChannelChip
            channelId={focused}
            onChange={setFocused}
            channels={paidChannels.map((c) => ({ id: c.id, label: c.label }))}
          />
        </SectionHead>
        <LeverBridge levers={levers} />
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
          Reading: emerald bars built GMV, accent bars eroded it. The widest bar is
          the dominant lever — the one to act on. CTR moves are usually
          creative/placement; CVR moves point to landing experience or audience;
          AOV moves point to mix.
        </p>
      </div>

      {/* Marimekko */}
      <div>
        <SectionHead
          kicker="Spend × Return"
          title="Where the money goes — and what it earns"
          byline="bar width = share of working spend · height = ROAS · dashed line = blended"
        />
        <div style={{ border: `1px solid ${C.rule}`, padding: 16, background: C.paper }}>
          <Marimekko items={mosaicItems} height={320} />
        </div>
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
          Wide-and-short bars are the reallocation candidates: large spend pull,
          sub-blended return. Narrow-and-tall bars are scaling candidates —
          efficient channels with room to absorb more.
        </p>
      </div>
    </div>
  );
}

function ChannelChip({
  channelId,
  onChange,
  channels,
}: {
  channelId: Channel;
  onChange: (c: Channel) => void;
  channels: { id: Channel; label: string }[];
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: `1px solid ${C.rule}`,
        padding: "4px 10px",
        background: C.paper2,
      }}
    >
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 9,
          color: C.ink3,
          letterSpacing: "0.10em",
        }}
      >
        FOCUS
      </span>
      <select
        value={channelId}
        onChange={(e) => onChange(e.target.value as Channel)}
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          fontWeight: 600,
          color: C.ink,
          paddingRight: 14,
          cursor: "pointer",
        }}
      >
        {channels.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
