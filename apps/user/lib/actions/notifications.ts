"use server";

import { prisma } from "@knock/db";
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
    route: getNotificationRoute(n.type, n.targetId ?? n.roomId),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));
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
