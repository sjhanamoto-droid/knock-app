import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSite } from "@/lib/actions/sites";
import { PostJobClient } from "./post-job-client";

type Props = {
  params: Promise<{ siteId: string }>;
};

export default async function SitePostJobPage({ params }: Props) {
  const { siteId } = await params;

  const site = await getSite(siteId);

  if (!site) {
    notFound();
  }

  return (
    <Suspense>
      <PostJobClient
        siteId={siteId}
        initialSite={site}
      />
    </Suspense>
  );
}
