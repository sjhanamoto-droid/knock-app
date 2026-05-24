import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSite, getProjectSummary } from "@/lib/actions/sites";
import { SiteDetailClient } from "./site-detail-client";

type Props = {
  params: Promise<{ siteId: string }>;
};

export default async function SiteDetailPage({ params }: Props) {
  const { siteId } = await params;

  const site = await getSite(siteId);

  if (!site) {
    notFound();
  }

  const projectSummary = !site.parentId
    ? await getProjectSummary(site.id).catch(() => null)
    : null;

  return (
    <Suspense>
      <SiteDetailClient
        siteId={siteId}
        initialSite={site}
        initialProjectSummary={projectSummary}
      />
    </Suspense>
  );
}
