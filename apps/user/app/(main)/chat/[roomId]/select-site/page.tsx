import { getSites } from "@/lib/actions/sites";
import { SelectSiteClient } from "./select-site-client";

export default async function SelectSitePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const initialSites = await getSites("NOT_ORDERED", undefined);

  return <SelectSiteClient initialSites={initialSites} roomId={roomId} />;
}
