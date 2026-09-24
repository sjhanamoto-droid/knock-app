import { getInvoiceCandidates } from "@/lib/actions/invoices";
import { CandidatesClient } from "./candidates-client";

export default async function BillingCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const { ym } = await searchParams;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  // ?ym=YYYYMM の月の請求可能な取引先を表示（請求書管理で開いていた月）
  if (ym && /^\d{6}$/.test(ym)) {
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(4, 6));
    if (m >= 1 && m <= 12) {
      year = y;
      month = m;
    }
  }
  const yearMonth = `${year}${String(month).padStart(2, "0")}`;
  const candidates = await getInvoiceCandidates(yearMonth);

  return <CandidatesClient candidates={candidates} year={year} month={month} />;
}
