import { getOrderDetail } from "@/lib/actions/orders";
import { CompletionReviewClient } from "./completion-review-client";

export default async function CompletionReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initialOrder = await getOrderDetail(orderId);

  return <CompletionReviewClient initialOrder={initialOrder} orderId={orderId} />;
}
