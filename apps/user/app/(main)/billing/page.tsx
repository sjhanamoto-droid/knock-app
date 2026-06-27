import { getBillingList } from "@/lib/actions/invoices";
import { getDocumentCounterparties } from "@/lib/actions/documents";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const yearMonth = `${year}${String(month).padStart(2, "0")}`;

  const [invoices, counterparties] = await Promise.all([
    getBillingList(yearMonth),
    getDocumentCounterparties(),
  ]);

  return (
    <BillingClient
      initialInvoices={invoices}
      initialCounterparties={counterparties}
      initialYear={year}
      initialMonth={month}
    />
  );
}
