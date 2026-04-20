import Masthead from "@/components/masthead";
import { EditorialLens } from "@/components/lens/editorial";
import { DecisionsLens } from "@/components/lens/decisions";
import { DecompositionLens } from "@/components/lens/decomposition";
import { PacingLens } from "@/components/lens/pacing";
import { getPanel } from "@/lib/panel-data";
import type { Filters } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function parseFilters(sp: Record<string, string | undefined>): Filters {
  return {
    range: (sp.range as Filters["range"]) || DEFAULT_FILTERS.range,
    market: (sp.market as Filters["market"]) || DEFAULT_FILTERS.market,
    evc: sp.evc === "true",
    lens: (sp.lens as Filters["lens"]) || DEFAULT_FILTERS.lens,
  };
}

export default async function OverviewPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const panel = await getPanel({ evc: filters.evc });

  return (
    <>
      <Masthead filters={filters} />
      <main>
        {filters.lens === "editorial" && <EditorialLens panel={panel} filters={filters} />}
        {filters.lens === "decisions" && <DecisionsLens panel={panel} filters={filters} />}
        {filters.lens === "decomposition" && (
          <DecompositionLens panel={panel} filters={filters} />
        )}
        {filters.lens === "pacing" && <PacingLens panel={panel} filters={filters} />}
      </main>
    </>
  );
}
