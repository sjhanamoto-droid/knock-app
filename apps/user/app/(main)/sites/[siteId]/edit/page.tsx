import { notFound, redirect } from "next/navigation";
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

  // 発注依頼(ORDER_REQUESTED)以降は編集不可。直接アクセス時は詳細画面へ戻す。
  if (!["NOT_ORDERED", "DRAFT"].includes(site.status)) {
    redirect(`/sites/${siteId}`);
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
