import { getOrderDetail } from "@/lib/actions/orders";
import { getSessionUser } from "@/lib/session";
import { EvaluateClient } from "./evaluate-client";

export default async function EvaluatePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [initialOrder, user] = await Promise.all([
    getOrderDetail(orderId),
    getSessionUser(),
  ]);

  return (
    <EvaluateClient
      initialOrder={initialOrder}
      orderId={orderId}
      viewerCompanyId={user?.companyId ?? ""}
    />
  );
}
