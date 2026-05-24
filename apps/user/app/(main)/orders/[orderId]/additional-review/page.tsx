import { getAdditionalOrderDetail } from "@/lib/actions/orders";
import { AdditionalReviewClient } from "./additional-review-client";

export default async function AdditionalReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initialOrder = await getAdditionalOrderDetail(orderId);

  if (!initialOrder) {
    return <div className="p-4 text-center text-knock-text-muted">追加工事が見つかりません</div>;
  }

  return <AdditionalReviewClient initialOrder={initialOrder} orderId={orderId} />;
}
