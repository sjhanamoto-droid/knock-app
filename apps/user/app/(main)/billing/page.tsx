import { getBillingList, getInvoiceCandidates } from "@/lib/actions/invoices";
import { BillingClient } from "./billing-client";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const { ym } = await searchParams;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  // ?ym=YYYYMM があればその月を表示（詳細から戻ったとき、開いていた月を復元）
  if (ym && /^\d{6}$/.test(ym)) {
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(4, 6));
    if (m >= 1 && m <= 12) {
      year = y;
      month = m;
    }
  }
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
