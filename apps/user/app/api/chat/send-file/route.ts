import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { sendPushToUsers } from "@/lib/push";

export async function POST(req: NextRequest) {
  try {
    const user = await requireSession();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const roomId = formData.get("roomId") as string | null;

    if (!file || !roomId) {
      return NextResponse.json({ error: "ファイルとルームIDが必要です" }, { status: 400 });
    }

    // メンバー確認
    const member = await prisma.chatRoomMember.findFirst({
      where: { roomId, userId: user.id, deletedAt: null },
    });
    if (!member) {
      return NextResponse.json({ error: "チャットルームのメンバーではありません" }, { status: 403 });
    }

    // ファイルをbase64データURLに変換
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "application/octet-stream";
    const fileUrl = `data:${mimeType};base64,${base64}`;

    // 画像判定（MIMEタイプ or 拡張子）
    const isImage = mimeType.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(file.name);

    // メッセージ作成
    const newMessage = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          roomId,
          userId: user.id,
          message: file.name,
          file: fileUrl,
          type: "FILE",
          jsonImage: isImage ? { url: fileUrl, name: file.name } : undefined,
        },
        include: {
          user: { select: { id: true, lastName: true, firstName: true, avatar: true } },
        },
      });

      await tx.chatRoom.update({
        where: { id: roomId },
        data: { lastMessageTime: new Date() },
      });

      await tx.chatRoomMember.updateMany({
        where: { roomId, userId: { not: user.id }, deletedAt: null },
        data: { unreadCount: { increment: 1 } },
      });

      return msg;
    });

    // Push通知
    const otherMembers = await prisma.chatRoomMember.findMany({
      where: { roomId, userId: { not: user.id }, deletedAt: null },
      select: { userId: true },
    });
    if (otherMembers.length > 0) {
      const senderName = user.name || "Knock";
      void sendPushToUsers({
        userIds: otherMembers.map((m) => m.userId),
        title: senderName,
        body: `📎 ${file.name}`,
        url: `/chat/${roomId}`,
      });
    }

    return NextResponse.json(newMessage);
  } catch (err) {
    console.error("Chat file upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ファイルの送信に失敗しました" },
      { status: 500 }
    );
  }
}
