"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { calcOrderSubtotal, calcTax } from "@/lib/helpers/order-amount";

/**
 * ホームのカードに表示する発注書ごとのステータス。
 * 現場(FactoryFloor)のステータスは同じ現場の別発注（追加工事など）の影響を受けるため、
 * 色分け・絞り込みは発注書ごとの状態で行う。
 */
export type HomeCardStatus = "REQUESTED" | "AWAITING_CONFIRM" | "IN_PROGRESS" | "COMPLETED";

const COMPLETED_SITE_STATUSES = ["COMPLETED", "DELIVERY_APPROVED", "INVOICED", "DEAL_COMPLETED"];
/**
 * V2: 進行中の取引一覧
 * 未完了のFactoryFloorOrderを取得（ステータスが取引完了でないもの）
 */
export async function getActiveTransactions() {
  const user = await requireSession();

  const orders = await prisma.factoryFloorOrder.findMany({
    where: {
      deletedAt: null,
      // 発注がキャンセル/却下された取引はホームに残さない
      status: {
        notIn: ["CANCELLED", "REJECTED"],
      },
      factoryFloor: {
        deletedAt: null,
        status: {
          notIn: ["DRAFT", "NOT_ORDERED", "DEAL_COMPLETED"],
        },
        OR: [
          { companyId: user.companyId },
          { workCompanyId: user.companyId },
        ],
      },
    },
    select: {
      id: true,
      status: true,
      completionStatus: true,
      inspectionData: true,
      factoryFloor: {
        select: {
          id: true,
          name: true,
          status: true,
          address: true,
          startDayRequest: true,
          endDayRequest: true,
          companyId: true,
          totalAmount: true,
          company: { select: { id: true, name: true } },
          workCompany: { select: { id: true, name: true } },
          parent: { select: { id: true, name: true } },
          priceDetails: {
            where: { deletedAt: null },
            select: { quantity: true, priceUnit: true },
          },
          chatRooms: {
            where: {
              type: "SITE_INFO",
              deletedAt: null,
              members: { some: { userId: user.id, deletedAt: null } },
            },
            select: { id: true },
            take: 1,
          },
        },
      },
      // 確定済みの金額は注文書の実額（請求と同じ基準）
      documents: {
        where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, totalAmount: true },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    // 未完了の工事を取りこぼさないよう多めに取得（クライアント側で期間/完了・並び替え・絞り込み）
    take: 200,
  });

  // 発注済以降のステータス
  const orderedStatuses = [
    "ORDERED", "ORDER_REQUESTED", "CONFIRMED", "IN_PROGRESS",
    "INSPECTION", "COMPLETED", "DELIVERY_APPROVED", "INVOICED", "DEAL_COMPLETED",
  ];

  type AdditionalOrderData = {
    type?: string;
    priceDetails?: { quantity: number; priceUnit: number }[];
  };

  return orders.map((order) => {
    const additionalData = order.inspectionData as AdditionalOrderData | null;
    const isAdditional = additionalData?.type === "ADDITIONAL_ORDER";
    const orderSheet = order.documents[0] ?? null;

    // 税込金額: 注文書があればその実額、未発行(依頼中など)なら注文書と同じ計算で算出
    let amount: number;
    if (orderSheet?.totalAmount != null) {
      amount = Number(orderSheet.totalAmount);
    } else {
      const subtotal = calcOrderSubtotal({
        isAdditional,
        additionalDetails: additionalData?.priceDetails,
        floorDetails: order.factoryFloor.priceDetails,
        floorTotalAmount: order.factoryFloor.totalAmount,
      });
      amount = Number(subtotal + calcTax(subtotal));
    }

    const cardStatus: HomeCardStatus =
      order.status === "PENDING"
        ? "REQUESTED"
        : order.status === "APPROVED"
          ? "AWAITING_CONFIRM"
          : order.completionStatus === "CLOSED" || COMPLETED_SITE_STATUSES.includes(order.factoryFloor.status)
            ? "COMPLETED"
            : "IN_PROGRESS";

    return {
      id: order.id,
      orderStatus: order.status,
      completionStatus: order.completionStatus,
      isAdditional,
      cardStatus,
      amount,
      orderSheetId: orderSheet?.id ?? null,
      // この取引で自社が発注者か（発注者/受注者の両方をしている会社でも取引ごとに判定）
      viewerIsOrderer: order.factoryFloor.companyId === user.companyId,
      siteId: order.factoryFloor.id,
      siteName: order.factoryFloor.name ?? "名称未設定",
      parentSiteId: order.factoryFloor.parent?.id ?? null,
      parentSiteName: order.factoryFloor.parent?.name ?? null,
      siteStatus: order.factoryFloor.status,
      address: order.factoryFloor.address,
      startDayRequest: order.factoryFloor.startDayRequest,
      endDayRequest: order.factoryFloor.endDayRequest,
      ordererName: order.factoryFloor.company?.name ?? "",
      contractorName: order.factoryFloor.workCompany?.name ?? "",
      siteInfoRoomId:
        orderedStatuses.includes(order.factoryFloor.status)
          ? order.factoryFloor.chatRooms[0]?.id ?? null
          : null,
    };
  });
}

/**
 * V2: 今月のサマリー
 * 当月の取引件数と合計金額
 */
export async function getMonthlySummary() {
  const user = await requireSession();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 当月に締切(CLOSED)された発注を集計する。
  // 請求と同じ基準: 完了日(completedDay) と 注文書(ORDER_SHEET)の実額を用いる。
  const closedOrders = await prisma.factoryFloorOrder.findMany({
    where: {
      deletedAt: null,
      status: "CONFIRMED",
      completionStatus: "CLOSED",
      completedDay: { gte: startOfMonth, lte: endOfMonth },
      factoryFloor: {
        deletedAt: null,
        OR: [
          { companyId: user.companyId },
          { workCompanyId: user.companyId },
        ],
      },
    },
    select: {
      factoryFloor: { select: { companyId: true } },
      documents: {
        where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
        select: { totalAmount: true },
      },
    },
  });

  const totalCount = closedOrders.length;
  let totalAmount = BigInt(0);
  for (const order of closedOrders) {
    for (const sheet of order.documents) {
      totalAmount += sheet.totalAmount ?? BigInt(0);
    }
  }

  return {
    count: totalCount,
    amount: Number(totalAmount),
    isOrderer: closedOrders.some((o) => o.factoryFloor.companyId === user.companyId),
  };
}

/**
 * V2: ホーム画面のバッジカウント
 */
export async function getHomeBadgeCounts() {
  const user = await requireSession();

  const [unreadNotifications, unreadChats, unorderedWorks] = await Promise.all([
    prisma.notification.count({
      where: { userId: user.id, seenFlag: false, deletedAt: null },
    }),
    prisma.chatRoomMember.aggregate({
      where: { userId: user.id, deletedAt: null },
      _sum: { unreadCount: true },
    }),
    // 未発注の子工事(「工事を追加」した各工事)の件数。発注待ちの作業をホームで気付けるように。
    prisma.factoryFloor.count({
      where: {
        companyId: user.companyId,
        parentId: { not: null },
        status: "NOT_ORDERED",
        deletedAt: null,
      },
    }),
  ]);

  return {
    notifications: unreadNotifications,
    chats: unreadChats._sum.unreadCount ?? 0,
    unorderedWorks,
  };
}
