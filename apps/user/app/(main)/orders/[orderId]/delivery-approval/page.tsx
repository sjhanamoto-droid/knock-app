import { getOrderDetail } from "@/lib/actions/orders";
import { DeliveryApprovalClient } from "./delivery-approval-client";

export default async function DeliveryApprovalPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initialOrder = await getOrderDetail(orderId);

  return <DeliveryApprovalClient initialOrder={initialOrder} orderId={orderId} />;
}
