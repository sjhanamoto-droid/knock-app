import { getServerMode } from "@/lib/mode-server";
import { getSites, getContractorSites } from "@/lib/actions/sites";
import { SitesClient } from "./sites-client";

type Site = Awaited<ReturnType<typeof getSites>>[number];

export default async function SitesPage() {
  const modeData = await getServerMode();
  const sites = modeData.isOrderer
    ? await getSites()
    : ((await getContractorSites()) as unknown as Site[]);

  return <SitesClient initialSites={sites} />;
}
