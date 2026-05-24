import { getDocuments, getDocumentCounterparties } from "@/lib/actions/documents";
import { getInvoiceCandidates } from "@/lib/actions/invoices";
import { DocumentsClient } from "./documents-client";

export default async function DocumentsPage() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [counterparties, result, candidates] = await Promise.all([
    getDocumentCounterparties(),
    getDocuments({ yearMonth: currentMonth }),
    getInvoiceCandidates(currentMonth),
  ]);

  return (
    <DocumentsClient
      initialCounterparties={counterparties}
      initialResult={result}
      initialCandidates={candidates}
      initialCurrentMonth={currentMonth}
    />
  );
}
