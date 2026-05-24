import { getChatRooms } from "@/lib/actions/chat";
import { ChatClient } from "./chat-client";

export default async function ChatPage() {
  const data = await getChatRooms();

  return (
    <ChatClient
      initialRooms={data.rooms}
      initialMyCompanyId={data.myCompanyId}
    />
  );
}
