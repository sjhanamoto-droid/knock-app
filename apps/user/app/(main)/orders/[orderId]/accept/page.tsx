import { redirect } from "next/navigation";
import { getOrderDetail } from "@/lib/actions/orders";
import { AcceptClient } from "./accept-client";

export default async function OrderAcceptPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const initialOrder = await getOrderDetail(orderId);

  // 追加工事の発注依頼は専用ページ(追加工事の明細を表示)で回答する
  if ((initialOrder?.inspectionData as { type?: string } | null)?.type === "ADDITIONAL_ORDER") {
    redirect(`/orders/${orderId}/additional-review`);
  }

  return <AcceptClient initialOrder={initialOrder} orderId={orderId} />;
}
