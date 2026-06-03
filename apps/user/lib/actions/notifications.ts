"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getNotificationRoute } from "@/lib/notification-route";

export async function getNotifications() {
  const user = await requireSession();
  const myCompanyId = user.companyId;

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (notifications.length === 0) return [];

  // 発信者(= 受信者から見た相手会社)を 現場 / チャットルーム / 注文 / 帳票 の文脈から導出する。
  // Notification には送信者列が無いため、関連IDから相手会社名を解決する。
  const floorIds = new Set<string>();
  const roomIds = new Set<string>();
  const targetIds = new Set<string>();
  for (const n of notifications) {
    if (n.factoryFloorId) floorIds.add(n.factoryFloorId);
    if (n.roomId) roomIds.add(n.roomId);
    if (n.targetId) targetIds.add(n.targetId);
  }
  const roomLookupIds = [...new Set([...roomIds, ...targetIds])];
  const floorSelect = {
    companyId: true,
    company: { select: { name: true } },
    workCompany: { select: { name: true } },
  } as const;

  const [floors, rooms, orders, documents] = await Promise.all([
    prisma.factoryFloor.findMany({ where: { id: { in: [...floorIds] } }, select: { id: true, ...floorSelect } }),
    prisma.chatRoom.findMany({
      where: { id: { in: roomLookupIds } },
      select: { id: true, orderCompanyId: true, orderCompany: { select: { name: true } }, workerCompany: { select: { name: true } } },
    }),
    prisma.factoryFloorOrder.findMany({ where: { id: { in: [...targetIds] } }, select: { id: true, factoryFloor: { select: floorSelect } } }),
    prisma.document.findMany({
      where: { id: { in: [...targetIds] } },
      select: { id: true, factoryFloorOrder: { select: { factoryFloor: { select: floorSelect } } } },
    }),
  ]);

  type FloorCompanies = {
    companyId: string;
    company: { name: string | null } | null;
    workCompany: { name: string | null } | null;
  };
  const floorCp = (f: FloorCompanies | null | undefined): string | null =>
    f ? ((f.companyId === myCompanyId ? f.workCompany?.name : f.company?.name) ?? null) : null;

  const floorMap = new Map<string, FloorCompanies>(floors.map((f) => [f.id, f]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const orderFloorMap = new Map<string, FloorCompanies>(orders.map((o) => [o.id, o.factoryFloor]));
  const docFloorMap = new Map<string, FloorCompanies | null>(
    documents.map((d) => [d.id, d.factoryFloorOrder?.factoryFloor ?? null])
  );

  const roomCp = (r: (typeof rooms)[number] | null | undefined): string | null =>
    r ? ((r.orderCompanyId === myCompanyId ? r.workerCompany?.name : r.orderCompany?.name) ?? null) : null;

  function resolveSender(n: (typeof notifications)[number]): string | null {
    if (n.factoryFloorId) {
      const s = floorCp(floorMap.get(n.factoryFloorId));
      if (s) return s;
    }
    if (n.roomId) {
      const s = roomCp(roomMap.get(n.roomId));
      if (s) return s;
    }
    if (n.targetId) {
      const s =
        roomCp(roomMap.get(n.targetId)) ??
        floorCp(orderFloorMap.get(n.targetId)) ??
        floorCp(docFloorMap.get(n.targetId));
      if (s) return s;
    }
    return null;
  }

  return notifications.map((n) => ({
    ...n,
    // 運営お知らせ(type=100)は全画面の詳細画面へ。それ以外は従来のルーティング。
    route:
      n.type === 100
        ? `/notifications/${n.id}`
        : getNotificationRoute(n.type, n.targetId ?? n.roomId),
    // 発信者(相手会社名)。導出できない場合は null。
    senderName: resolveSender(n),
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
