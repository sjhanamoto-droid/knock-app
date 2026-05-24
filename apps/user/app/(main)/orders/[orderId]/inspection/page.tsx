import { getOrderDetail } from "@/lib/actions/orders";
import { getUnits } from "@/lib/actions/sites";
import { InspectionClient } from "./inspection-client";

export default async function InspectionPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [initialOrder, initialUnits] = await Promise.all([
    getOrderDetail(orderId),
    getUnits(),
  ]);

  return <InspectionClient initialOrder={initialOrder} initialUnits={initialUnits} orderId={orderId} />;
}
