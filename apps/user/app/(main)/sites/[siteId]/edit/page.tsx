import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSite, getUnits } from "@/lib/actions/sites";
import { getOccupationMasters } from "@/lib/actions/occupations";
import { SiteEditClient } from "./site-edit-client";

type Props = {
  params: Promise<{ siteId: string }>;
};

export default async function EditSitePage({ params }: Props) {
  const { siteId } = await params;

  const [site, occupationMasters, units] = await Promise.all([
    getSite(siteId),
    getOccupationMasters(),
    getUnits(),
  ]);

  if (!site) {
    notFound();
  }

  return (
    <Suspense>
      <SiteEditClient
        siteId={siteId}
        site={site}
        occupationMasters={occupationMasters}
        units={units}
      />
    </Suspense>
  );
}
