import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getSite } from "@/lib/actions/sites";
import { getContractor } from "@/lib/actions/contractors";
import { OrderConfirmClient } from "./order-confirm-client";

type Props = {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ companyId?: string }>;
};

export default async function OrderConfirmPage({ params, searchParams }: Props) {
  const { siteId } = await params;
  const { companyId } = await searchParams;

  if (!companyId) {
    redirect(`/sites/${siteId}/order`);
  }

  const [site, contractor] = await Promise.all([
    getSite(siteId),
    getContractor(companyId),
  ]);

  if (!site || !contractor) {
    notFound();
  }

  return (
    <Suspense>
      <OrderConfirmClient
        siteId={siteId}
        companyId={companyId}
        initialSite={site}
        initialContractor={contractor}
      />
    </Suspense>
  );
}
