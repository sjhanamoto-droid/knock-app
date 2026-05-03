"use server";

import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { requireSession } from "@/lib/session";

export async function getChatRooms(type?: "NEGOTIATION" | "SITE_INFO") {
  const user = await requireSession();

  const where: Record<string, unknown> = {
    deletedAt: null,
    members: {
      some: {
        userId: user.id,
        deletedAt: null,
      },
    },
  };

  if (type) {
    where.type = type;
  }

  const rooms = await prisma.chatRoom.findMany({
    where,
    orderBy: { lastMessageTime: "desc" },
    include: {
      orderCompany: { select: { id: true, name: true, logo: true } },
      workerCompany: { select: { id: true, name: true, logo: true } },
      factoryFloor: {
        select: {
          id: true,
          name: true,
          parentId: true,
          parent: { select: { id: true, name: true } },
        },
      },
      members: {
        where: { userId: user.id, deletedAt: null },
        select: { unreadCount: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { message: true, createdAt: true, type: true },
      },
    },
  });

  return {
    myCompanyId: user.companyId,
    rooms: rooms.map((room) => ({
      ...room,
      unreadCount: room.members[0]?.unreadCount ?? 0,
      lastMessage: room.messages[0] ?? null,
    })),
  };
}

export async function getChatRoom(roomId: string) {
  const user = await requireSession();

  const room = await prisma.chatRoom.findFirst({
    where: {
      id: roomId,
      deletedAt: null,
      members: {
        some: { userId: user.id, deletedAt: null },
      },
    },
    include: {
      orderCompany: { select: { id: true, name: true } },
      workerCompany: { select: { id: true, name: true } },
      factoryFloor: {
        select: {
          id: true,
          name: true,
          status: true,
          companyId: true,
          orders: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              documents: {
                where: { deletedAt: null },
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  type: true,
                  status: true,
                  documentNumber: true,
                  totalAmount: true,
                  issuedAt: true,
                },
              },
            },
          },
        },
      },
      members: {
        where: { deletedAt: null },
        include: {
          user: { select: { id: true, lastName: true, firstName: true, avatar: true } },
        },
      },
    },
  });

  if (!room) throw new Error("チャットルームが見つかりません");

  const messages = await prisma.message.findMany({
    where: { roomId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, lastName: true, firstName: true, avatar: true } },
    },
  });

  return { room, messages, myCompanyId: user.companyId, myCompanyType: user.companyType };
}

export async function sendMessage(roomId: string, message: string) {
  const user = await requireSession();

  const trimmed = message.trim();
  if (!trimmed) throw new Error("メッセージを入力してください");
  if (trimmed.length > 10000) throw new Error("メッセージが長すぎます");

  const member = await prisma.chatRoomMember.findFirst({
    where: { roomId, userId: user.id, deletedAt: null },
  });
  if (!member) throw new Error("チャットルームのメンバーではありません");

  const newMessage = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        roomId,
        userId: user.id,
        message: trimmed,
        type: "TEXT",
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

  // 他メンバーにPush通知を送信
  const otherMembers = await prisma.chatRoomMember.findMany({
    where: { roomId, userId: { not: user.id }, deletedAt: null },
    select: { userId: true },
  });
  if (otherMembers.length > 0) {
    const senderName = user.name || "Knock";
    void sendPushToUsers({
      userIds: otherMembers.map((m) => m.userId),
      title: senderName,
      body: trimmed.length > 50 ? trimmed.slice(0, 50) + "…" : trimmed,
      url: `/chat/${roomId}`,
    });
  }

  return newMessage;
}

export async function getNewMessages(roomId: string, afterId: string) {
  const user = await requireSession();

  // メンバー確認
  const member = await prisma.chatRoomMember.findFirst({
    where: { roomId, userId: user.id, deletedAt: null },
  });
  if (!member) throw new Error("チャットルームのメンバーではありません");

  // afterId のメッセージの createdAt を取得してカーソルとして使う
  const cursor = await prisma.message.findUnique({
    where: { id: afterId },
    select: { createdAt: true },
  });

  if (!cursor) return [];

  const messages = await prisma.message.findMany({
    where: {
      roomId,
      deletedAt: null,
      createdAt: { gt: cursor.createdAt },
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, lastName: true, firstName: true, avatar: true } },
    },
  });

  return messages;
}

export async function sendFileMessage(roomId: string, fileUrl: string, fileName: string) {
  const user = await requireSession();

  if (!fileUrl) {
    throw new Error("無効なファイルURLです");
  }

  const member = await prisma.chatRoomMember.findFirst({
    where: { roomId, userId: user.id, deletedAt: null },
  });
  if (!member) throw new Error("チャットルームのメンバーではありません");

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);

  const newMessage = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        roomId,
        userId: user.id,
        message: fileName,
        file: fileUrl,
        type: "FILE",
        jsonImage: isImage ? { url: fileUrl, name: fileName } : undefined,
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

  // 他メンバーにPush通知を送信
  const otherMembers = await prisma.chatRoomMember.findMany({
    where: { roomId, userId: { not: user.id }, deletedAt: null },
    select: { userId: true },
  });
  if (otherMembers.length > 0) {
    const senderName = user.name || "Knock";
    void sendPushToUsers({
      userIds: otherMembers.map((m) => m.userId),
      title: senderName,
      body: `📎 ${fileName}`,
      url: `/chat/${roomId}`,
    });
  }

  return newMessage;
}

export async function getNegotiationRoomId(partnerCompanyId: string): Promise<string | null> {
  const user = await requireSession();

  const room = await prisma.chatRoom.findFirst({
    where: {
      type: "NEGOTIATION",
      deletedAt: null,
      OR: [
        { orderCompanyId: user.companyId, workerCompanyId: partnerCompanyId },
        { orderCompanyId: partnerCompanyId, workerCompanyId: user.companyId },
      ],
    },
    select: { id: true },
  });

  return room?.id ?? null;
}

export async function markAsRead(roomId: string) {
  const user = await requireSession();

  await prisma.chatRoomMember.updateMany({
    where: { roomId, userId: user.id, deletedAt: null },
    data: { unreadCount: 0 },
  });
}
