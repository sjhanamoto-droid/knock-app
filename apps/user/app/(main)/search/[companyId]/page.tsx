import { getContractor } from "@/lib/actions/contractors";
import { ContractorDetailClient } from "./contractor-detail-client";

export default async function ContractorDetailPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const contractor = await getContractor(companyId);
  return <ContractorDetailClient initialContractor={contractor} companyId={companyId} />;
}
