import { getOrderDetail } from "@/lib/actions/orders";
import { requireSession } from "@/lib/session";
import { CompletionReportClient } from "./completion-report-client";

export default async function CompletionReportPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [initialOrder, user] = await Promise.all([getOrderDetail(orderId), requireSession()]);

  return (
    <CompletionReportClient
      initialOrder={initialOrder}
      orderId={orderId}
      viewerCompanyId={user.companyId}
    />
  );
}
