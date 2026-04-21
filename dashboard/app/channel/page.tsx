import { redirect } from "next/navigation";

/**
 * Legacy route kept for backward-compat with shared links. The Channel Brief
 * now lives as a tab under /advanced?tab=channel.
 */
interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ChannelRedirect({ searchParams }: PageProps) {
  const sp = await searchParams;
  const forwarded = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v != null) forwarded.set(k, v);
  }
  forwarded.set("tab", "channel");
  redirect(`/advanced?${forwarded.toString()}`);
}
