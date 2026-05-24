import { getBillingList } from "@/lib/actions/invoices";
import { BillingClient } from "./billing-client";

export default async function BillingPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const yearMonth = `${year}${String(month).padStart(2, "0")}`;

  const invoices = await getBillingList(yearMonth);

  return (
    <BillingClient
      initialInvoices={invoices}
      initialYear={year}
      initialMonth={month}
    />
  );
}
