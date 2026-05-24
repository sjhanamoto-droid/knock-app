import { getAvailableDeliveryNotes } from "@/lib/actions/invoices";
import { NewInvoiceClient } from "./new-invoice-client";

export default async function NewInvoicePage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const yearMonth = `${year}${String(month).padStart(2, "0")}`;

  const initialNotes = await getAvailableDeliveryNotes(yearMonth);

  return (
    <NewInvoiceClient
      initialNotes={initialNotes}
      initialYear={year}
      initialMonth={month}
    />
  );
}
