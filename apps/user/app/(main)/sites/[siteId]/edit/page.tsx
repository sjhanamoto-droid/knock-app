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

  // 親プロジェクト(子工事を持つ)は予算管理(工事発注予算・追加発注予算)のため、
  // 施工中でも編集を許可する。単独現場・子工事は発注依頼以降は編集不可。
  const isParentProject = site.parentId == null && (site.children?.length ?? 0) > 0;
  if (!isParentProject && !["NOT_ORDERED", "DRAFT"].includes(site.status)) {
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
