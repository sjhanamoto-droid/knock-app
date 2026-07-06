import { getBillingList, getInvoiceCandidates } from "@/lib/actions/invoices";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const yearMonth = `${year}${String(month).padStart(2, "0")}`;

  const [invoices, candidates] = await Promise.all([
    getBillingList(yearMonth),
    getInvoiceCandidates(yearMonth),
  ]);

  return (
    <BillingClient
      initialInvoices={invoices}
      initialCandidates={candidates}
      initialYear={year}
      initialMonth={month}
    />
  );
}
