import { getDocumentDetail } from "@/lib/actions/documents";
import { BillingDetailClient } from "./billing-detail-client";

export default async function BillingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ ym?: string }>;
}) {
  const { documentId } = await params;
  const { ym } = await searchParams;
  const doc = await getDocumentDetail(documentId);

  return <BillingDetailClient initialDoc={doc} documentId={documentId} backYm={ym ?? null} />;
}
