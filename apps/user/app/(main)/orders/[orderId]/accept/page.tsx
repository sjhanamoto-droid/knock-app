import { getOrderDetail } from "@/lib/actions/orders";
import { AcceptClient } from "./accept-client";

export default async function OrderAcceptPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initialOrder = await getOrderDetail(orderId);

  return <AcceptClient initialOrder={initialOrder} orderId={orderId} />;
}
