import Masthead from "@/components/masthead";
import { DailyReport } from "@/components/daily-report";
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
    lens: DEFAULT_FILTERS.lens, // unused on /daily-report, kept for Masthead type
  };
}

export default async function DailyReportPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const panel = await getPanel({ evc: filters.evc });

  return (
    <>
      <Masthead filters={filters} />
      <main>
        <DailyReport panel={panel} filters={filters} />
      </main>
    </>
  );
}
