import { getOrderDetail } from "@/lib/actions/orders";
import { ConfirmClient } from "./confirm-client";

export default async function OrderConfirmPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initialOrder = await getOrderDetail(orderId);

  return <ConfirmClient initialOrder={initialOrder} orderId={orderId} />;
}
