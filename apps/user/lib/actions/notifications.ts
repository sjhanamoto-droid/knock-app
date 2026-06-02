"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getNotificationRoute } from "@/lib/notification-route";

export async function getNotifications() {
  const user = await requireSession();

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return notifications.map((n) => ({
    ...n,
    // 運営お知らせ(type=100)は全画面の詳細画面へ。それ以外は従来のルーティング。
    route:
      n.type === 100
        ? `/notifications/${n.id}`
        : getNotificationRoute(n.type, n.targetId ?? n.roomId),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));
}

/**
 * お知らせ詳細を取得し、未読なら既読として記録する（全画面の確認画面用）。
 * 自分宛の通知のみ取得できる。
 */
export async function getNotificationDetail(id: string) {
  const user = await requireSession();

  const n = await prisma.notification.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!n) return null;

  if (!n.seenFlag) {
    await prisma.notification.update({
      where: { id: n.id },
      data: { seenFlag: true },
    });
  }

  return {
    id: n.id,
    title: n.title,
    content: n.content,
    type: n.type,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function markNotificationAsRead(id: string) {
  const user = await requireSession();

  return prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { seenFlag: true },
  });
}

export async function markAllNotificationsAsRead() {
  const user = await requireSession();

  return prisma.notification.updateMany({
    where: { userId: user.id, seenFlag: false },
    data: { seenFlag: true },
  });
}

export async function getUnreadCount() {
  const user = await requireSession();

  return prisma.notification.count({
    where: {
      userId: user.id,
      seenFlag: false,
      deletedAt: null,
    },
  });
}
