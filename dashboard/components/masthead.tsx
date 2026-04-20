"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { C, FONT } from "@/lib/tokens";
import { MARKETS } from "@/lib/taxonomy";
import type { Filters } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";

const LENSES: { id: Filters["lens"]; label: string; sub: string }[] = [
  { id: "editorial", label: "Editorial", sub: "narrative + WoW" },
  { id: "decisions", label: "Decisions", sub: "3 ranked moves" },
  { id: "decomposition", label: "Decomposition", sub: "levers + waterfall" },
  { id: "pacing", label: "Pacing", sub: "MTD vs plan" },
];

const RANGE_OPTIONS: { value: Filters["range"]; label: string }[] = [
  { value: "7", label: "7 DAYS" },
  { value: "14", label: "14 DAYS" },
  { value: "30", label: "30 DAYS" },
  { value: "mtd", label: "MTD" },
];

export default function Masthead({ filters }: { filters: Filters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onOverview = pathname === "/";

  const updateParam = useCallback(
    (patch: Partial<Filters>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === DEFAULT_FILTERS[k as keyof Filters] || v === false) sp.delete(k);
        else sp.set(k, String(v));
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const asOf = new Date("2026-04-20").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header
      style={{
        background: C.paper,
        borderBottom: `1px solid ${C.rule}`,
        paddingTop: 12,
      }}
    >
      {/* Status strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 32px 8px",
          fontSize: 10,
          fontFamily: FONT.mono,
          color: C.ink3,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ display: "inline-flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: C.ink2 }}>
            mart.{filters.evc ? "daily_channel_panel_evc" : "daily_channel_panel"}
          </span>
          <span style={{ color: C.ink4 }}>·</span>
          <span>as of {asOf}</span>
          {filters.evc && (
            <span
              style={{
                color: C.accent,
                fontWeight: 700,
                letterSpacing: "0.12em",
                marginLeft: 4,
              }}
            >
              EVC ON
            </span>
          )}
        </span>
        <span style={{ display: "flex", gap: 24 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: C.paper2,
              padding: "2px 8px",
              color: C.ink3,
              fontWeight: 600,
              letterSpacing: "0.12em",
            }}
          >
            SIMULATED DATA
          </span>
          <span>Refreshed 02:07 SGT · T−1 final</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.moss,
              }}
            />
            All extractors green
          </span>
        </span>
      </div>

      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          padding: "0 32px 14px",
          borderBottom: `2px solid ${C.rule}`,
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: FONT.sans,
              fontWeight: 600,
              fontSize: "clamp(22px, 2.6vw, 32px)",
              lineHeight: 1,
              letterSpacing: "-0.025em",
              display: "inline-flex",
              alignItems: "baseline",
              gap: 10,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                background: C.accent,
                transform: "translateY(-2px)",
                flexShrink: 0,
              }}
            />
            SEA Retail Media{" "}
            <span style={{ fontWeight: 400, color: C.ink3 }}>/ SSOT</span>
          </h1>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: C.ink3,
              fontFamily: FONT.mono,
              letterSpacing: "0.04em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            single source of truth · Shopee &amp; TikTok Shop performance across 6 SEA markets
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <NavTab
            label="Overview"
            active={pathname === "/"}
            href={withQs("/", searchParams.toString())}
          />
          <NavTab
            label="Channel"
            active={pathname.startsWith("/channel")}
            href={withQs("/channel", searchParams.toString())}
          />
        </div>
      </div>

      {/* Lens strip — only on overview */}
      {onOverview && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            padding: "0 32px",
            height: 38,
            borderBottom: `1px solid ${C.rule}`,
            background: C.paper2,
            fontFamily: FONT.mono,
            fontSize: 11,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              paddingRight: 16,
              color: C.ink3,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 600,
              borderRight: `1px solid ${C.ruleSoft}`,
            }}
          >
            Lens
          </span>
          {LENSES.map((v) => (
            <LensTab
              key={v.id}
              label={v.label}
              sub={v.sub}
              active={filters.lens === v.id}
              onClick={() => updateParam({ lens: v.id })}
            />
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "0 32px",
          height: 36,
          borderBottom: `1px solid ${C.rule}`,
          fontFamily: FONT.mono,
          fontSize: 11,
          color: C.ink,
        }}
      >
        <FilterCell
          label="Window"
          value={filters.range}
          options={RANGE_OPTIONS}
          onChange={(v) => updateParam({ range: v as Filters["range"] })}
        />
        <Divider />
        <FilterCell
          label="Market"
          value={filters.market}
          options={[
            { value: "all", label: "ALL SEA" },
            ...MARKETS.map((m) => ({ value: m.code, label: `${m.code} ${m.name.toUpperCase()}` })),
          ]}
          onChange={(v) => updateParam({ market: v as Filters["market"] })}
        />
        <Divider />
        <FilterCell
          label="Currency"
          value="USD"
          options={[{ value: "USD", label: "USD" }]}
          onChange={() => {}}
        />
        <Divider />
        <EvcToggle
          evc={filters.evc}
          onChange={(v) => updateParam({ evc: v })}
        />
        <div style={{ flex: 1 }} />
        <span style={{ color: C.ink3, marginRight: 12 }}>as_of 2026-04-19</span>
        <button
          type="button"
          style={{
            background: "transparent",
            border: `1px solid ${C.ink}`,
            padding: "5px 12px",
            fontFamily: FONT.mono,
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: C.ink,
          }}
        >
          EXPORT CSV
        </button>
      </div>
    </header>
  );
}

function withQs(path: string, qs: string): string {
  return qs ? `${path}?${qs}` : path;
}

function LensTab({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.paper : "transparent",
        border: "none",
        borderRight: `1px solid ${C.ruleSoft}`,
        borderTop: active ? `2px solid ${C.accent}` : "2px solid transparent",
        padding: "4px 18px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 2,
        fontFamily: FONT.mono,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: active ? 700 : 500,
          color: active ? C.ink : C.ink2,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textAlign: "left",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 9,
          color: active ? C.accent : C.ink3,
          letterSpacing: "0.04em",
          textAlign: "left",
        }}
      >
        {sub}
      </span>
    </button>
  );
}

function NavTab({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      style={{
        background: active ? C.ink : "transparent",
        color: active ? C.paper : C.ink,
        border: `1px solid ${C.ink}`,
        padding: "8px 16px",
        fontFamily: FONT.mono,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 500,
        textDecoration: "none",
        display: "inline-block",
      }}
    >
      {label}
    </Link>
  );
}

function FilterCell({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: "100%",
        padding: "0 16px",
      }}
    >
      <span style={{ color: C.ink3, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </span>
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.ink,
            paddingRight: 14,
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          style={{
            position: "absolute",
            right: 0,
            fontSize: 8,
            pointerEvents: "none",
          }}
        >
          ▼
        </span>
      </div>
    </label>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: C.ruleSoft }} />;
}

function EvcToggle({ evc, onChange }: { evc: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        height: "100%",
        padding: "0 16px",
        cursor: "pointer",
      }}
      title="Engaged-View Conversions — toggle switches between mart.daily_channel_panel and mart.daily_channel_panel_evc"
    >
      <span style={{ color: C.ink3, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        EVC
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={evc}
        onClick={() => onChange(!evc)}
        style={{
          width: 40,
          height: 18,
          padding: 0,
          background: evc ? C.accent : C.paper2,
          border: `1px solid ${evc ? C.accent : C.ink4}`,
          position: "relative",
          cursor: "pointer",
          transition: "background 0.12s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: evc ? 22 : 1,
            width: 14,
            height: 14,
            background: evc ? C.paper : C.ink2,
            transition: "left 0.12s",
          }}
        />
      </button>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: evc ? C.accent : C.ink3,
          letterSpacing: "0.08em",
          minWidth: 24,
        }}
      >
        {evc ? "ON" : "OFF"}
      </span>
    </label>
  );
}
