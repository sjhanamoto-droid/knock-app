import { getOrder } from "@/lib/actions/orders";
import { OrderDetailClient } from "./order-detail-client";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initialOrder = await getOrder(orderId);

  return <OrderDetailClient initialOrder={initialOrder} orderId={orderId} />;
}
