import { getDocuments, getDocumentCounterparties } from "@/lib/actions/documents";
import { DocumentsClient } from "./documents-client";

// 帳票一覧(全て)は廃止。初期表示は注文書一覧（URL ?type=INVOICE の場合はクライアント側で取得し直す）。
export default async function DocumentsPage() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [counterparties, result] = await Promise.all([
    getDocumentCounterparties(),
    getDocuments({ type: "ORDER_SHEET", yearMonth: currentMonth, limit: 200 }),
  ]);

  return (
    <DocumentsClient
      initialCounterparties={counterparties}
      initialResult={result}
      initialCurrentMonth={currentMonth}
    />
  );
}
