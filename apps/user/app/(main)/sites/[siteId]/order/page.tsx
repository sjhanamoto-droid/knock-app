import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSite } from "@/lib/actions/sites";
import { searchContractors } from "@/lib/actions/contractors";
import { OrderClient } from "./order-client";

type Props = {
  params: Promise<{ siteId: string }>;
};

export default async function OrderSelectContractorPage({ params }: Props) {
  const { siteId } = await params;

  const [site, contractors] = await Promise.all([
    getSite(siteId),
    searchContractors(),
  ]);

  if (!site) {
    notFound();
  }

  return (
    <Suspense>
      <OrderClient
        siteId={siteId}
        initialSite={site}
        initialContractors={contractors}
      />
    </Suspense>
  );
}
