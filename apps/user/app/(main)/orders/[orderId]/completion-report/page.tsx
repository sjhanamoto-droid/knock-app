import { getOrderDetail } from "@/lib/actions/orders";
import { requireSession } from "@/lib/session";
import { getInvoicedOrderIds } from "@/lib/helpers/invoiced-orders";
import { CompletionReportClient } from "./completion-report-client";

export default async function CompletionReportPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [initialOrder, user] = await Promise.all([getOrderDetail(orderId), requireSession()]);
  // 請求書(非VOID)に含まれている発注書は発注者でも差し戻せない
  const isInvoiced = initialOrder
    ? (await getInvoicedOrderIds({ companyIdEitherSide: user.companyId })).has(orderId)
    : false;

  return (
    <CompletionReportClient
      initialOrder={initialOrder}
      orderId={orderId}
      viewerCompanyId={user.companyId}
      isInvoiced={isInvoiced}
    />
  );
}
