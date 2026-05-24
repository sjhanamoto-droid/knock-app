import { getDocumentDetail } from "@/lib/actions/documents";
import { DocumentDetailClient } from "./document-detail-client";

export default async function DocumentDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const doc = await getDocumentDetail(documentId);

  return <DocumentDetailClient initialDoc={doc} />;
}
