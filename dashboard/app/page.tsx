import { Suspense } from "react";
import Masthead from "@/components/masthead";
import { EditorialLens } from "@/components/lens/editorial";
import { LensPlaceholder } from "@/components/lens/placeholder";
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
        <Suspense>
          {filters.lens === "editorial" && <EditorialLens panel={panel} filters={filters} />}
          {filters.lens === "decisions" && (
            <LensPlaceholder
              title="Decisions — 3 ranked reallocation moves"
              kicker="Decisions"
              note="This lens is the three-card reallocation view pinned in priority order (Google → Shopee Ads → Meta CPAS). The chart primitives (ConnectedScatter, Watchlist) and the mock-data hooks are in place; the card layout ships in Phase 2 of this dashboard rollout."
            />
          )}
          {filters.lens === "decomposition" && (
            <LensPlaceholder
              title="Decomposition — waterfall, levers, marimekko"
              kicker="Decomposition"
              note="Ships in Phase 2. The Waterfall / LeverBridge / Marimekko primitives already exist in components/charts/; this view just composes them with the weekly story output."
            />
          )}
          {filters.lens === "pacing" && (
            <LensPlaceholder
              title="Pacing — MTD dials, channel pacing, small-multiples"
              kicker="Pacing"
              note="Ships in Phase 2. PacingDial + SmallMultiples primitives are implemented; this view computes MTD vs plan forecasts and renders the channel × market grid."
            />
          )}
        </Suspense>
      </main>
    </>
  );
}
