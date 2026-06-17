import { redirect } from "next/navigation";
import { getOrder } from "@/lib/actions/orders";
import { OrderDetailClient } from "./order-detail-client";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initialOrder = await getOrder(orderId);

  // 追加工事は専用ページ(明細・ラベルが追加工事用)で表示する
  if ((initialOrder?.inspectionData as { type?: string } | null)?.type === "ADDITIONAL_ORDER") {
    redirect(`/orders/${orderId}/additional-review`);
  }

  return <OrderDetailClient initialOrder={initialOrder} orderId={orderId} />;
}
