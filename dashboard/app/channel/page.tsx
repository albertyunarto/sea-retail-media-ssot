import Masthead from "@/components/masthead";
import { LensPlaceholder } from "@/components/lens/placeholder";
import type { Filters } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ChannelPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters: Filters = {
    range: (sp.range as Filters["range"]) || DEFAULT_FILTERS.range,
    market: (sp.market as Filters["market"]) || DEFAULT_FILTERS.market,
    evc: sp.evc === "true",
    lens: "editorial",
  };
  return (
    <>
      <Masthead filters={filters} />
      <main>
        <LensPlaceholder
          title="Channel Brief — compact dropdown + market breakdown + heatmap"
          kicker="Channel Deep-Dive"
          note="Ships in Phase 2. The masthead, filter bar, and EVC toggle are wired; the deep-dive body (6-up KPI strip, time series, market breakdown, multi-channel comparison, market×day heatmap) will reuse the chart primitives already in place."
        />
      </main>
    </>
  );
}
