"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireKyc } from "@/lib/actions/verification";
import { generateOrderSheet, generateDeliveryNote } from "@/lib/services/document-generator";
import { sendPushToUsers } from "@/lib/push";

export async function getOrders(status?: string) {
  const user = await requireSession();

  const where: Record<string, unknown> = {
    deletedAt: null,
    OR: [
      { factoryFloor: { companyId: user.companyId, deletedAt: null } },
      { workCompanyId: user.companyId, factoryFloor: { deletedAt: null } },
    ],
  };

  if (status) {
    where.status = status;
  }

  const orders = await prisma.factoryFloorOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      factoryFloor: {
        select: {
          id: true, name: true, status: true, companyId: true, workCompanyId: true,
          company: { select: { id: true, name: true } },
          workCompany: { select: { id: true, name: true } },
        },
      },
    },
  });

  return orders.map((o) => ({ ...o, viewerCompanyId: user.companyId }));
}

export async function getOrder(id: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id,
      deletedAt: null,
      OR: [
        { factoryFloor: { companyId: user.companyId, deletedAt: null } },
        { workCompanyId: user.companyId, factoryFloor: { deletedAt: null } },
      ],
    },
    include: {
      factoryFloor: {
        select: {
          id: true,
          name: true,
          status: true,
          address: true,
          companyId: true,
          workCompanyId: true,
          startDayRequest: true,
          endDayRequest: true,
          company: {
            select: { id: true, name: true },
          },
          workCompany: {
            select: { id: true, name: true },
          },
          priceDetails: {
            where: { deletedAt: null },
            include: { unit: true },
          },
        },
      },
      billingRequests: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) return null;
  return { ...order, viewerCompanyId: user.companyId };
}

export async function approveOrder(id: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id,
      deletedAt: null,
      factoryFloor: { companyId: user.companyId },
    },
  });
  if (!order) throw new Error("発注が見つかりません");

  return prisma.factoryFloorOrder.update({
    where: { id },
    data: { status: "APPROVED" },
  });
}

export async function rejectOrder(id: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id,
      deletedAt: null,
      workCompanyId: user.companyId,
    },
    include: {
      factoryFloor: {
        select: { id: true, name: true, companyId: true },
      },
    },
  });
  if (!order) throw new Error("発注が見つかりません");
  if (order.status !== "PENDING") throw new Error("この発注は既に処理済みです");

  return prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: id, seenFlag: false },
      data: { seenFlag: true },
    });

    await tx.factoryFloorOrder.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    // 現場ステータスを「未発注」に戻し、施工会社をクリア
    await tx.factoryFloor.update({
      where: { id: order.factoryFloor.id },
      data: {
        status: "NOT_ORDERED",
        workCompanyId: null,
      },
    });

    // 交渉ルーム（NEGOTIATION）に辞退通知
    const negoRoom = await tx.chatRoom.findFirst({
      where: {
        type: "NEGOTIATION",
        deletedAt: null,
        OR: [
          { orderCompanyId: order.factoryFloor.companyId, workerCompanyId: user.companyId },
          { orderCompanyId: user.companyId, workerCompanyId: order.factoryFloor.companyId },
        ],
      },
    });
    if (negoRoom) {
      await tx.message.create({
        data: {
          roomId: negoRoom.id,
          userId: user.id,
          message: `「${order.factoryFloor.name}」の発注を辞退しました`,
          type: "ACTION",
          actionType: "ORDER_REQUEST",
          factoryFloorOrderId: id,
        },
      });
      await tx.chatRoom.update({
        where: { id: negoRoom.id },
        data: { lastMessageTime: new Date() },
      });
    }

    // 発注者に「辞退されました」通知を送信
    const ordererUsers = await tx.user.findMany({
      where: { companyId: order.factoryFloor.companyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: "発注辞退",
          content: `「${order.factoryFloor.name}」の発注が辞退されました`,
          type: 31,
          factoryFloorId: order.factoryFloor.id,
          targetId: order.factoryFloor.id,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: "発注辞退",
        body: `「${order.factoryFloor.name}」の発注が辞退されました`,
        url: `/sites/${order.factoryFloor.id}`,
      });
    }

    return { id };
  });
}

export async function cancelOrder(id: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id,
      deletedAt: null,
      factoryFloor: { companyId: user.companyId },
    },
    include: {
      factoryFloor: {
        select: { id: true, name: true, workCompanyId: true },
      },
    },
  });
  if (!order) throw new Error("発注が見つかりません");
  if (order.status !== "PENDING" && order.status !== "APPROVED") {
    throw new Error("この発注は既にキャンセルできない状態です");
  }

  return prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: id, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 発注ステータスをキャンセルに
    await tx.factoryFloorOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    // 2. 現場ステータスを「未発注」に戻し、施工会社をクリア
    await tx.factoryFloor.update({
      where: { id: order.factoryFloor.id },
      data: {
        status: "NOT_ORDERED",
        workCompanyId: null,
      },
    });

    // 3. 交渉ルーム（NEGOTIATION）にキャンセル通知
    if (order.factoryFloor.workCompanyId) {
      const negoRoom = await tx.chatRoom.findFirst({
        where: {
          type: "NEGOTIATION",
          deletedAt: null,
          OR: [
            { orderCompanyId: user.companyId, workerCompanyId: order.factoryFloor.workCompanyId },
            { orderCompanyId: order.factoryFloor.workCompanyId, workerCompanyId: user.companyId },
          ],
        },
      });
      if (negoRoom) {
        await tx.message.create({
          data: {
            roomId: negoRoom.id,
            userId: user.id,
            message: `「${order.factoryFloor.name}」の発注がキャンセルされました`,
            type: "ACTION",
            actionType: "ORDER_REQUEST",
            factoryFloorOrderId: id,
            keyCollection: order.factoryFloor.id,
          },
        });
        await tx.chatRoom.update({
          where: { id: negoRoom.id },
          data: { lastMessageTime: new Date() },
        });
      }

      // 4. 受注者に「キャンセルされました」通知を送信
      const contractorUsers = await tx.user.findMany({
        where: { companyId: order.factoryFloor.workCompanyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (contractorUsers.length > 0) {
        await tx.notification.createMany({
          data: contractorUsers.map((u) => ({
            userId: u.id,
            title: "発注キャンセル",
            content: `「${order.factoryFloor.name}」の発注がキャンセルされました`,
            type: 31,
            factoryFloorId: order.factoryFloor.id,
            targetId: order.factoryFloor.id,
          })),
        });
        void sendPushToUsers({
          userIds: contractorUsers.map((u) => u.id),
          title: "発注キャンセル",
          body: `「${order.factoryFloor.name}」の発注がキャンセルされました`,
          url: `/sites/${order.factoryFloor.id}`,
        });
      }
    }

    return { id };
  });
}

// ============ 発注依頼作成 ============

export async function createOrderRequest(data: {
  factoryFloorId: string;
  workCompanyId: string;
  message?: string;
}) {
  await requireKyc(); // Level 2必須
  const user = await requireSession();

  // 現場の存在・所有権・ステータス確認
  const floor = await prisma.factoryFloor.findFirst({
    where: {
      id: data.factoryFloorId,
      companyId: user.companyId,
      status: "NOT_ORDERED",
      deletedAt: null,
    },
  });
  if (!floor) throw new Error("発注可能な現場が見つかりません");

  // 受注者会社の確認
  const workCompany = await prisma.company.findFirst({
    where: {
      id: data.workCompanyId,
      type: { in: ["CONTRACTOR", "BOTH"] },
      isActive: true,
      deletedAt: null,
    },
  });
  if (!workCompany) throw new Error("施工会社が見つかりません");

  // メンバー接続確認（Matchingが存在しない場合は発注不可）
  const matching = await prisma.matching.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { inviteCompanyId: user.companyId, beInviteCompanyId: data.workCompanyId },
        { inviteCompanyId: data.workCompanyId, beInviteCompanyId: user.companyId },
      ],
    },
  });
  if (!matching) throw new Error("発注するには先につながり申請を承認してもらう必要があります");

  return prisma.$transaction(async (tx) => {
    // 1. 発注レコード作成
    const order = await tx.factoryFloorOrder.create({
      data: {
        factoryFloorId: data.factoryFloorId,
        workCompanyId: data.workCompanyId,
        status: "PENDING",
        message: data.message || null,
      },
    });

    // 2. 現場ステータス更新 + 施工会社設定
    await tx.factoryFloor.update({
      where: { id: data.factoryFloorId },
      data: {
        status: "ORDER_REQUESTED",
        workCompanyId: data.workCompanyId,
      },
    });

    // 3. 交渉ルーム（NEGOTIATION）に発注依頼メッセージ
    const negoRoom = await tx.chatRoom.findFirst({
      where: {
        type: "NEGOTIATION",
        deletedAt: null,
        OR: [
          { orderCompanyId: user.companyId, workerCompanyId: data.workCompanyId },
          { orderCompanyId: data.workCompanyId, workerCompanyId: user.companyId },
        ],
      },
    });
    if (negoRoom) {
      await tx.message.create({
        data: {
          roomId: negoRoom.id,
          userId: user.id,
          message: data.message || `「${floor.name}」の発注依頼を送信しました`,
          type: "ACTION",
          actionType: "ORDER_REQUEST",
          factoryFloorOrderId: order.id,
        },
      });
      await tx.chatRoom.update({
        where: { id: negoRoom.id },
        data: { lastMessageTime: new Date() },
      });
    }

    // 4. 受注者ユーザーへ通知作成
    const contractorUsers = await tx.user.findMany({
      where: { companyId: data.workCompanyId, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (contractorUsers.length > 0) {
      await tx.notification.createMany({
        data: contractorUsers.map((u) => ({
          userId: u.id,
          title: "発注依頼",
          content: `${floor.name}の発注依頼が届きました`,
          type: 21,
          factoryFloorId: data.factoryFloorId,
          roomId: negoRoom?.id ?? null,
          targetId: order.id,
        })),
      });
      void sendPushToUsers({
        userIds: contractorUsers.map((u) => u.id),
        title: "発注依頼",
        body: `${floor.name}の発注依頼が届きました`,
        url: `/orders/${order.id}/accept`,
      });
    }

    return order;
  });
}

// ============ V2: 発注確定（注文書自動生成） ============

export async function confirmOrder(orderId: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      factoryFloor: { companyId: user.companyId, deletedAt: null },
    },
    include: {
      factoryFloor: {
        select: { id: true, name: true, workCompanyId: true },
      },
    },
  });
  if (!order) throw new Error("発注が見つかりません");

  // 受注者の了承後のみ確定可能
  if (order.status !== "APPROVED") {
    throw new Error("受注者が了承していない発注は確定できません");
  }

  // 注文書を先に生成（トランザクション外で実行しコネクションプール枯渇を防ぐ）
  const documentId = await generateOrderSheet(orderId);

  return prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: orderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 発注ステータスを確定に更新
    await tx.factoryFloorOrder.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" },
    });

    // 2. 現場ステータスを施工中に更新（注文書発行 = 施工開始）
    await tx.factoryFloor.update({
      where: { id: order.factoryFloor.id },
      data: { status: "IN_PROGRESS" },
    });

    // 3. SITE_INFOチャットルームを作成（施工確定時に初めて作成）
    let siteRoom = await tx.chatRoom.findFirst({
      where: {
        factoryFloorId: order.factoryFloor.id,
        type: "SITE_INFO",
        deletedAt: null,
      },
    });

    if (!siteRoom) {
      siteRoom = await tx.chatRoom.create({
        data: {
          orderCompanyId: user.companyId,
          workerCompanyId: order.factoryFloor.workCompanyId!,
          factoryFloorId: order.factoryFloor.id,
          type: "SITE_INFO",
          status: "OPEN",
          lastMessageTime: new Date(),
        },
      });

      // 両社のアクティブユーザーをメンバーに追加
      const allUsers = await tx.user.findMany({
        where: {
          companyId: { in: [user.companyId, order.factoryFloor.workCompanyId!] },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (allUsers.length > 0) {
        await tx.chatRoomMember.createMany({
          data: allUsers.map((u) => ({
            roomId: siteRoom!.id,
            userId: u.id,
            roleUser: 2,
          })),
        });
      }
    }

    // 4. SITE_INFOルームにACTIONメッセージ追加
    await tx.message.create({
      data: {
        roomId: siteRoom.id,
        userId: user.id,
        message: "注文書が発行されました",
        type: "ACTION",
        actionType: "ORDER_CONFIRM",
        factoryFloorOrderId: orderId,
        keyCollection: documentId,
      },
    });
    await tx.chatRoom.update({
      where: { id: siteRoom.id },
      data: { lastMessageTime: new Date() },
    });

    // 5. 受注者に通知（type 24 → /chat/${chatRoomId}）
    if (order.factoryFloor.workCompanyId) {
      const contractorUsers = await tx.user.findMany({
        where: { companyId: order.factoryFloor.workCompanyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (contractorUsers.length > 0) {
        await tx.notification.createMany({
          data: contractorUsers.map((u) => ({
            userId: u.id,
            title: "発注確定",
            content: `${order.factoryFloor.name}の発注が確定しました。注文書が発行されています。`,
            type: 24,
            factoryFloorId: order.factoryFloor.id,
            targetId: siteRoom!.id,
          })),
        });
        void sendPushToUsers({
          userIds: contractorUsers.map((u) => u.id),
          title: "発注確定",
          body: `${order.factoryFloor.name}の発注が確定しました。注文書が発行されています。`,
          url: `/chat/${siteRoom!.id}`,
        });
      }
    }

    return { orderId, documentId };
  });
}

// ============ V2: 受注確認 ============

export async function acceptOrder(orderId: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      workCompanyId: user.companyId,
    },
    include: {
      factoryFloor: {
        select: { id: true, name: true, companyId: true },
      },
    },
  });
  if (!order) throw new Error("発注が見つかりません");
  if (order.status !== "PENDING") throw new Error("この発注は既に処理済みです");

  return prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: orderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 発注ステータスを「了承」に更新 + 現場ステータスを「発注済」に更新
    await tx.factoryFloorOrder.update({
      where: { id: orderId },
      data: { status: "APPROVED" },
    });
    await tx.factoryFloor.update({
      where: { id: order.factoryFloor.id },
      data: { status: "ORDERED" },
    });

    // 2. 交渉ルーム（NEGOTIATION）に承認通知
    const negoRoom = await tx.chatRoom.findFirst({
      where: {
        type: "NEGOTIATION",
        deletedAt: null,
        OR: [
          { orderCompanyId: order.factoryFloor.companyId, workerCompanyId: user.companyId },
          { orderCompanyId: user.companyId, workerCompanyId: order.factoryFloor.companyId },
        ],
      },
    });
    if (negoRoom) {
      await tx.message.create({
        data: {
          roomId: negoRoom.id,
          userId: user.id,
          message: `「${order.factoryFloor.name}」の発注を承認しました`,
          type: "ACTION",
          actionType: "ORDER_CONFIRM",
          factoryFloorOrderId: orderId,
        },
      });
      await tx.chatRoom.update({
        where: { id: negoRoom.id },
        data: { lastMessageTime: new Date() },
      });
    }

    // 3. 発注者に通知（type 20 → /orders/${orderId}/confirm）
    const ordererUsers = await tx.user.findMany({
      where: { companyId: order.factoryFloor.companyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: "受注了承",
          content: `${order.factoryFloor.name}が受注されました。注文書を発行してください。`,
          type: 20,
          factoryFloorId: order.factoryFloor.id,
          targetId: orderId,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: "受注了承",
        body: `${order.factoryFloor.name}が受注されました。注文書を発行してください。`,
        url: `/orders/${orderId}/confirm`,
      });
    }

    return { orderId };
  });
}

// ============ V2: 完了報告（受注者） ============

export async function submitCompletionReport(data: {
  factoryFloorOrderId: string;
  completionDate: string;
  comment?: string;
  photos: string[];
  hasAdditionalWork?: boolean;
  additionalWorkDescription?: string;
  additionalWorkAmount?: number;
}) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: data.factoryFloorOrderId,
      deletedAt: null,
      workCompanyId: user.companyId,
    },
    include: {
      factoryFloor: {
        select: { id: true, name: true, companyId: true },
      },
    },
  });
  if (!order) throw new Error("取引が見つかりません");
  if (order.status !== "CONFIRMED") throw new Error("完了報告を送信できる状態ではありません");

  return prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: data.factoryFloorOrderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 完了報告を作成
    const report = await tx.completionReport.create({
      data: {
        factoryFloorOrderId: data.factoryFloorOrderId,
        completionDate: new Date(data.completionDate),
        comment: data.comment,
        photos: data.photos,
        hasAdditionalWork: data.hasAdditionalWork ?? false,
        additionalWorkDescription: data.additionalWorkDescription,
        additionalWorkAmount: data.additionalWorkAmount ? BigInt(data.additionalWorkAmount) : null,
      },
    });

    // 2. 現場ステータスを「検収中」に更新
    await tx.factoryFloor.update({
      where: { id: order.factoryFloor.id },
      data: { status: "INSPECTION" },
    });

    // 3. 発注者に通知
    const ordererUsers = await tx.user.findMany({
      where: { companyId: order.factoryFloor.companyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: "完了報告",
          content: `${order.factoryFloor.name}の完了報告が届きました。確認してください。`,
          type: 22,
          factoryFloorId: order.factoryFloor.id,
          targetId: data.factoryFloorOrderId,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: "完了報告",
        body: `${order.factoryFloor.name}の完了報告が届きました。確認してください。`,
        url: `/orders/${data.factoryFloorOrderId}/completion-review`,
      });
    }

    return report;
  });
}

// ============ V2: 検収・金額調整（発注者） ============

export async function submitInspection(data: {
  factoryFloorOrderId: string;
  finalAmount: number;
  memo?: string;
  additionalItems?: { name: string; quantity: number; unitId: string; priceUnit: number; specifications: string }[];
  expenses?: number;
  adjustmentAmount?: number;
  advancePayment?: number;
}) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: data.factoryFloorOrderId,
      deletedAt: null,
      factoryFloor: { companyId: user.companyId, deletedAt: null },
    },
    include: {
      factoryFloor: {
        select: { id: true, name: true, status: true, workCompanyId: true },
      },
    },
  });
  if (!order) throw new Error("取引が見つかりません");
  if (order.factoryFloor.status !== "INSPECTION") throw new Error("検収を実行できる状態ではありません");

  // 内訳データをJSON化
  const inspectionData = {
    additionalItems: data.additionalItems ?? [],
    expenses: data.expenses ?? 0,
    adjustmentAmount: data.adjustmentAmount ?? 0,
    advancePayment: data.advancePayment ?? 0,
    memo: data.memo ?? "",
  };

  return prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: data.factoryFloorOrderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 最終金額 + 内訳データを設定
    await tx.factoryFloorOrder.update({
      where: { id: data.factoryFloorOrderId },
      data: {
        actualAmount: BigInt(data.finalAmount),
        inspectionData: inspectionData,
      },
    });

    // 2. 諸経費・前払金・備考を現場に保存
    await tx.factoryFloor.update({
      where: { id: order.factoryFloor.id },
      data: {
        expenses: data.expenses != null ? BigInt(data.expenses) : undefined,
        totalAdvancePayment: data.advancePayment ?? undefined,
        remarks: data.memo || undefined,
        status: "COMPLETED",
      },
    });

    // 3. 受注者に納品金額確認の通知
    if (order.factoryFloor.workCompanyId) {
      const contractorUsers = await tx.user.findMany({
        where: { companyId: order.factoryFloor.workCompanyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (contractorUsers.length > 0) {
        await tx.notification.createMany({
          data: contractorUsers.map((u) => ({
            userId: u.id,
            title: "納品金額確認",
            content: `${order.factoryFloor.name}の納品金額をご確認ください。`,
            type: 25,
            factoryFloorId: order.factoryFloor.id,
            targetId: data.factoryFloorOrderId,
          })),
        });
        void sendPushToUsers({
          userIds: contractorUsers.map((u) => u.id),
          title: "納品金額確認",
          body: `${order.factoryFloor.name}の納品金額をご確認ください。`,
          url: `/orders/${data.factoryFloorOrderId}/inspection`,
        });
      }
    }

    return { orderId: data.factoryFloorOrderId };
  });
}

// ============ 納品金額の差し戻し（受注者 → 発注者） ============

export async function rejectInspection(orderId: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      workCompanyId: user.companyId,
    },
    include: {
      factoryFloor: {
        select: { id: true, name: true, status: true, companyId: true },
      },
    },
  });
  if (!order) throw new Error("取引が見つかりません");
  if (order.factoryFloor.status !== "COMPLETED") throw new Error("差し戻しできる状態ではありません");

  return prisma.$transaction(async (tx) => {
    // 通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: orderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 現場ステータスを CONFIRMED に戻す（発注者が再編集可能に）
    await tx.factoryFloor.update({
      where: { id: order.factoryFloor.id },
      data: { status: "CONFIRMED" },
    });

    // 発注者に差し戻し通知
    const ordererUsers = await tx.user.findMany({
      where: { companyId: order.factoryFloor.companyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: "納品金額が差し戻されました",
          content: `${order.factoryFloor.name}の納品金額が受注者より差し戻されました。`,
          type: 25,
          factoryFloorId: order.factoryFloor.id,
          targetId: orderId,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: "納品金額が差し戻されました",
        body: `${order.factoryFloor.name}の納品金額が受注者より差し戻されました。`,
        url: `/orders/${orderId}/inspection`,
      });
    }

    return { orderId };
  });
}

// ============ V2: 完了報告の再依頼（発注者） ============

export async function requestRevision(orderId: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      factoryFloor: { companyId: user.companyId, deletedAt: null },
    },
    include: {
      factoryFloor: {
        select: { id: true, name: true, status: true, workCompanyId: true },
      },
    },
  });
  if (!order) throw new Error("取引が見つかりません");
  if (order.factoryFloor.status !== "INSPECTION") throw new Error("再依頼できる状態ではありません");

  return prisma.$transaction(async (tx) => {
    // 1. 完了報告を削除
    await tx.completionReport.deleteMany({
      where: { factoryFloorOrderId: orderId },
    });

    // 2. 現場ステータスを CONFIRMED に戻す
    await tx.factoryFloor.update({
      where: { id: order.factoryFloor.id },
      data: { status: "CONFIRMED" },
    });

    // 3. 受注者に通知
    if (order.factoryFloor.workCompanyId) {
      const contractorUsers = await tx.user.findMany({
        where: { companyId: order.factoryFloor.workCompanyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (contractorUsers.length > 0) {
        await tx.notification.createMany({
          data: contractorUsers.map((u) => ({
            userId: u.id,
            title: "完了報告の再依頼",
            content: `${order.factoryFloor.name}の完了報告を再提出してください。`,
            type: 23,
            factoryFloorId: order.factoryFloor.id,
            targetId: orderId,
          })),
        });
        void sendPushToUsers({
          userIds: contractorUsers.map((u) => u.id),
          title: "完了報告の再依頼",
          body: `${order.factoryFloor.name}の完了報告を再提出してください。`,
          url: `/orders/${orderId}`,
        });
      }
    }

    return { orderId };
  });
}

// ============ V2: 納品承認（受注者）→ 納品書自動生成 ============

export async function approveDelivery(orderId: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      workCompanyId: user.companyId,
    },
    include: {
      factoryFloor: {
        select: { id: true, name: true, status: true, companyId: true },
      },
    },
  });
  if (!order) throw new Error("取引が見つかりません");
  if (order.factoryFloor.status !== "COMPLETED") throw new Error("納品承認できる状態ではありません");

  // 納品書を先に生成（トランザクション外で実行しコネクションプール枯渇を防ぐ）
  const documentId = await generateDeliveryNote(orderId);

  return prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: orderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 現場ステータスを「納品承認」に更新
    await tx.factoryFloor.update({
      where: { id: order.factoryFloor.id },
      data: { status: "DELIVERY_APPROVED" },
    });

    // 2. 発注者に通知
    const ordererUsers = await tx.user.findMany({
      where: { companyId: order.factoryFloor.companyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: "納品承認",
          content: `${order.factoryFloor.name}の納品が承認されました。納品書が発行されています。`,
          type: 30,
          factoryFloorId: order.factoryFloor.id,
          targetId: documentId,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: "納品承認",
        body: `${order.factoryFloor.name}の納品が承認されました。納品書が発行されています。`,
        url: `/documents/${documentId}`,
      });
    }

    return { orderId, documentId };
  });
}

// ============ V2: 取引完了 ============

export async function completeDeal(orderId: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      OR: [
        { factoryFloor: { companyId: user.companyId, deletedAt: null } },
        { workCompanyId: user.companyId, factoryFloor: { deletedAt: null } },
      ],
    },
    include: {
      factoryFloor: {
        select: { id: true, status: true },
      },
    },
  });
  if (!order) throw new Error("取引が見つかりません");

  await prisma.factoryFloor.update({
    where: { id: order.factoryFloor.id },
    data: { status: "DEAL_COMPLETED" },
  });

  return { orderId };
}

// ============ V2: 取引詳細（拡張版） ============

export async function getOrderDetail(orderId: string) {
  const user = await requireSession();

  return prisma.factoryFloorOrder.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      OR: [
        { factoryFloor: { companyId: user.companyId, deletedAt: null } },
        { workCompanyId: user.companyId, factoryFloor: { deletedAt: null } },
      ],
    },
    include: {
      factoryFloor: {
        include: {
          company: {
            select: {
              id: true, name: true, invoiceNumber: true,
              postalCode: true, prefecture: true, city: true, streetAddress: true, building: true,
            },
          },
          workCompany: {
            select: {
              id: true, name: true, invoiceNumber: true,
              postalCode: true, prefecture: true, city: true, streetAddress: true, building: true,
            },
          },
          priceDetails: { where: { deletedAt: null }, include: { unit: true } },
        },
      },
      completionReport: true,
      documents: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      evaluations: true,
    },
  });
}
