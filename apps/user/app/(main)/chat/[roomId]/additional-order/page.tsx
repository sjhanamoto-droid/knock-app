import { getChatRoom } from "@/lib/actions/chat";
import { getUnits } from "@/lib/actions/sites";
import { AdditionalOrderClient } from "./additional-order-client";

export default async function AdditionalOrderPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  const [chatData, unitList] = await Promise.all([
    getChatRoom(roomId),
    getUnits(),
  ]);

  const factoryFloorId = chatData.room.factoryFloor?.id ?? null;

  return (
    <AdditionalOrderClient
      factoryFloorId={factoryFloorId}
      initialUnits={unitList}
      roomId={roomId}
    />
  );
}
