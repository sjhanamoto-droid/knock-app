import { getOrderDetail } from "@/lib/actions/orders";
import { CompletionReportClient } from "./completion-report-client";

export default async function CompletionReportPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initialOrder = await getOrderDetail(orderId);

  return <CompletionReportClient initialOrder={initialOrder} orderId={orderId} />;
}
