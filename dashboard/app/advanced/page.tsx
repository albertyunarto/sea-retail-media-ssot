import Masthead from "@/components/masthead";
import { DecisionsLens } from "@/components/lens/decisions";
import { EditorialLens } from "@/components/lens/editorial";
import { DecompositionLens } from "@/components/lens/decomposition";
import { ChannelBrief } from "@/components/channel-brief";
import { getPanel } from "@/lib/panel-data";
import type { Filters } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const VALID_TABS: Filters["lens"][] = ["decisions", "narrative", "decomposition", "channel"];

function parseFilters(sp: Record<string, string | undefined>): Filters {
  const raw = (sp.tab ?? sp.lens) as Filters["lens"] | undefined;
  const lens = raw && VALID_TABS.includes(raw) ? raw : DEFAULT_FILTERS.lens;
  return {
    range: (sp.range as Filters["range"]) || DEFAULT_FILTERS.range,
    market: (sp.market as Filters["market"]) || DEFAULT_FILTERS.market,
    evc: sp.evc === "true",
    lens,
  };
}

export default async function AdvancedPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const panel = await getPanel({ evc: filters.evc });

  return (
    <>
      <Masthead filters={filters} />
      <main>
        {filters.lens === "decisions" && <DecisionsLens panel={panel} filters={filters} />}
        {filters.lens === "narrative" && <EditorialLens panel={panel} filters={filters} />}
        {filters.lens === "decomposition" && (
          <DecompositionLens panel={panel} filters={filters} />
        )}
        {filters.lens === "channel" && <ChannelBrief panel={panel} filters={filters} />}
      </main>
    </>
  );
}
