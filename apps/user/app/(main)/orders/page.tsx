import { getOrders } from "@/lib/actions/orders";
import { OrdersClient } from "./orders-client";

export default async function OrdersPage() {
  const initialOrders = await getOrders();

  return <OrdersClient initialOrders={initialOrders} />;
}
