import Masthead from "@/components/masthead";
import { ChannelBrief } from "@/components/channel-brief";
import { getPanel } from "@/lib/panel-data";
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
  const panel = await getPanel({ evc: filters.evc });
  return (
    <>
      <Masthead filters={filters} />
      <main>
        <ChannelBrief panel={panel} filters={filters} />
      </main>
    </>
  );
}
