import { C, FONT } from "@/lib/tokens";
import { SectionHeader } from "@/components/primitives";

export function LensPlaceholder({
  title,
  kicker,
  note,
}: {
  title: string;
  kicker: string;
  note: string;
}) {
  return (
    <div style={{ background: C.paper, padding: "24px 32px 48px" }}>
      <SectionHeader kicker={kicker} title={title} byline="preview · Phase 2" />
      <div
        style={{
          border: `1px dashed ${C.ink4}`,
          background: C.paper2,
          padding: "32px 28px",
          fontFamily: FONT.serif,
          fontSize: 14,
          lineHeight: 1.55,
          color: C.ink2,
          maxWidth: "72ch",
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.accent,
            marginBottom: 10,
            fontWeight: 700,
          }}
        >
          · Phase 2 scope
        </div>
        {note}
      </div>
    </div>
  );
}
