import { getDocumentDetail } from "@/lib/actions/documents";
import { BillingDetailClient } from "./billing-detail-client";

export default async function BillingDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const doc = await getDocumentDetail(documentId);

  return <BillingDetailClient initialDoc={doc} documentId={documentId} />;
}
