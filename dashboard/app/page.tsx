import Masthead from "@/components/masthead";
import { MainDashboard } from "@/components/main-dashboard";
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
    lens: DEFAULT_FILTERS.lens, // unused on /, kept for type-compat with Masthead
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
        <MainDashboard panel={panel} filters={filters} />
      </main>
    </>
  );
}
