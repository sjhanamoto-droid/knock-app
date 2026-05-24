import { getOrderDetail } from "@/lib/actions/orders";
import { EvaluateClient } from "./evaluate-client";

export default async function EvaluatePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initialOrder = await getOrderDetail(orderId);

  return <EvaluateClient initialOrder={initialOrder} orderId={orderId} />;
}
