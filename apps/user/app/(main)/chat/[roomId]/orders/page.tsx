import { getOrders } from "@/lib/actions/orders";
import { getChatRoom } from "@/lib/actions/chat";
import { ChatOrdersClient } from "./chat-orders-client";

type OrderList = Awaited<ReturnType<typeof getOrders>>;
type Order = OrderList[number];

export default async function ChatOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { roomId } = await params;
  const { companyId } = await searchParams;

  const [orderData, chatData] = await Promise.all([
    getOrders(),
    getChatRoom(roomId),
  ]);

  const isOrderer =
    chatData.myCompanyType === "ORDERER" || chatData.myCompanyType === "BOTH";

  const orders = companyId
    ? orderData.filter(
        (o: Order) =>
          o.factoryFloor.company?.id === companyId ||
          o.factoryFloor.workCompany?.id === companyId ||
          o.workCompanyId === companyId
      )
    : orderData;

  return <ChatOrdersClient initialOrders={orders} initialIsOrderer={isOrderer} />;
}
