import type { ReactNode } from "react";
import { C, FONT } from "@/lib/tokens";
import { fmtDelta } from "@/lib/format";

export function KPI({
  label,
  value,
  delta,
  sub,
  large = false,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  sub?: string;
  large?: boolean;
}) {
  const positive = delta != null && delta >= 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 10,
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
          fontWeight: 500,
          fontSize: large ? 56 : 36,
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: C.ink,
          fontVariantNumeric: "tabular-nums lining-nums",
        }}
      >
        {value}
      </div>
      {(delta != null || sub) && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            fontFamily: FONT.mono,
            fontSize: 11,
          }}
        >
          {delta != null && (
            <span
              style={{
                color: positive ? C.moss : C.accent,
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              {fmtDelta(delta)}
            </span>
          )}
          {sub && <span style={{ color: C.ink3 }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

export function SectionHead({
  kicker,
  title,
  byline,
  children,
}: {
  kicker?: string;
  title: ReactNode;
  byline?: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "flex-end",
        gap: 16,
        paddingBottom: 10,
        borderBottom: `1px solid ${C.rule}`,
        marginBottom: 14,
      }}
    >
      <div>
        {kicker && (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.accent,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 4,
              fontWeight: 600,
            }}
          >
            {kicker}
          </div>
        )}
        <div
          style={{
            fontFamily: FONT.serif,
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        {byline && (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: C.ink3,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            {byline}
          </div>
        )}
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}

const TAG_TONES = {
  ink: { bg: C.ink, fg: C.paper, border: false },
  accent: { bg: C.accent, fg: C.paper, border: false },
  gold: { bg: C.gold, fg: C.paper, border: false },
  moss: { bg: C.moss, fg: C.paper, border: false },
  indigo: { bg: C.indigo, fg: C.paper, border: false },
  ghost: { bg: "transparent", fg: C.ink, border: true },
} as const;

export function Tag({
  children,
  tone = "ink",
}: {
  children: ReactNode;
  tone?: keyof typeof TAG_TONES;
}) {
  const t = TAG_TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: t.bg,
        color: t.fg,
        border: t.border ? `1px solid ${C.ink}` : "none",
        fontFamily: FONT.mono,
        fontSize: 9,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        fontWeight: 600,
        padding: "2px 7px",
      }}
    >
      {children}
    </span>
  );
}

export const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${C.ink}`,
  padding: "5px 12px",
  fontFamily: FONT.mono,
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: C.ink,
  cursor: "pointer",
};

export function SectionHeader({
  kicker,
  title,
  byline,
}: {
  kicker: string;
  title: string;
  byline?: string;
}) {
  return (
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
        {kicker}
      </span>
      {byline && (
        <span
          style={{
            fontFamily: FONT.serif,
            fontSize: 13,
            color: C.ink2,
          }}
        >
          {byline}
        </span>
      )}
    </div>
  );
}
