import { getSite } from "@/lib/actions/sites";
import { getChatRoom } from "@/lib/actions/chat";
import { getTemplates } from "@/lib/actions/templates";
import { ChatOrderClient } from "./chat-order-client";

export default async function ChatOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ siteId?: string; companyId?: string }>;
}) {
  const { roomId } = await params;
  const { siteId } = await searchParams;

  if (!siteId) {
    return (
      <ChatOrderClient
        initialSite={null}
        initialTemplates={[]}
        initialPartnerName=""
        roomId={roomId}
      />
    );
  }

  const [siteData, templateData, chatData] = await Promise.all([
    getSite(siteId),
    getTemplates(),
    getChatRoom(roomId),
  ]);

  const partnerName =
    chatData.myCompanyId === chatData.room.orderCompany.id
      ? chatData.room.workerCompany.name
      : chatData.room.orderCompany.name;

  return (
    <ChatOrderClient
      initialSite={siteData}
      initialTemplates={templateData}
      initialPartnerName={partnerName ?? ""}
      roomId={roomId}
    />
  );
}
