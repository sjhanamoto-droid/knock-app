import { Suspense } from "react";
import { getOccupationMasters } from "@/lib/actions/occupations";
import { getUnits, getSite } from "@/lib/actions/sites";
import { SiteNewClient } from "./site-new-client";

type Props = {
  searchParams: Promise<{ parentId?: string }>;
};

export default async function NewSitePage({ searchParams }: Props) {
  const { parentId } = await searchParams;

  const [occupationMasters, units, parentSite] = await Promise.all([
    getOccupationMasters(),
    getUnits(),
    parentId ? getSite(parentId) : Promise.resolve(null),
  ]);

  const parentName = parentSite?.name ?? "";

  return (
    <Suspense>
      <SiteNewClient
        occupationMasters={occupationMasters}
        units={units}
        parentId={parentId ?? null}
        parentName={parentName}
      />
    </Suspense>
  );
}
