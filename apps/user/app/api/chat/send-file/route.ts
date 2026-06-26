import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { sendPushToUsers } from "@/lib/push";
import { validateChatFile } from "@/lib/upload-limits";

export async function POST(req: NextRequest) {
  try {
    const user = await requireSession();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const roomId = formData.get("roomId") as string | null;

    if (!file || !roomId) {
      return NextResponse.json({ error: "ファイルとルームIDが必要です" }, { status: 400 });
    }

    const fileErr = validateChatFile(file);
    if (fileErr) {
      return NextResponse.json({ error: fileErr }, { status: 400 });
    }

    // メンバー確認
    const member = await prisma.chatRoomMember.findFirst({
      where: { roomId, userId: user.id, deletedAt: null },
    });
    if (!member) {
      return NextResponse.json({ error: "チャットルームのメンバーではありません" }, { status: 403 });
    }

    // ファイルを Vercel Blob（実ストレージ）に保存し、短い公開URLを使う。
    // 以前は base64 データURIを message.file / jsonImage に保存しており、
    // DBが肥大化し大きいファイルで送信失敗しやすかった。
    const mimeType = file.type || "application/octet-stream";
    const blob = await put(`chat/${roomId}/${file.name || "file"}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || undefined,
    });
    const fileUrl = blob.url;

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
