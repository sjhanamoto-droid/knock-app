import { getAvailableDeliveryNotes } from "@/lib/actions/invoices";
import { NewInvoiceClient } from "./new-invoice-client";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ worker?: string; order?: string; name?: string }>;
}) {
  const { worker, order, name } = await searchParams;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const yearMonth = `${year}${String(month).padStart(2, "0")}`;

  // 一覧で選んだ取引先(worker/order)に絞って納品書を取得
  const initialNotes = await getAvailableDeliveryNotes(yearMonth, worker, order);

  return (
    <NewInvoiceClient
      initialNotes={initialNotes}
      initialYear={year}
      initialMonth={month}
      workerCompanyId={worker}
      orderCompanyId={order}
      counterpartyName={name}
    />
  );
}
