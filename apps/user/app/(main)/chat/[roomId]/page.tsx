import { getChatRoom } from "@/lib/actions/chat";
import { ChatRoomClient } from "./chat-room-client";

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const initialData = await getChatRoom(roomId);

  return <ChatRoomClient initialData={initialData} roomId={roomId} />;
}
