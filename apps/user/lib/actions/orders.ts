"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireKyc } from "@/lib/actions/verification";
import { generateOrderSheet } from "@/lib/services/document-generator";
import { sendPushToUsers } from "@/lib/push";
import { recalculateTrustScore } from "@/lib/services/trust-score";

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
          parent: { select: { name: true } },
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
          parent: { select: { name: true } },
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
      // 相互評価CTAの出し分け用（自社が評価済みか判定）
      evaluations: {
        select: { evaluatorCompanyId: true },
      },
      // 完了報告CTAの出し分け用（報告済みなら非表示）
      completionReport: { select: { id: true } },
    },
  });

  if (!order) return null;
  return { ...order, viewerCompanyId: user.companyId };
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

  // 二重送信対策: PENDING のものだけを REJECTED に原子的に遷移し、重複処理を防ぐ。
  const claim = await prisma.factoryFloorOrder.updateMany({
    where: { id, status: "PENDING", deletedAt: null },
    data: { status: "REJECTED" },
  });
  if (claim.count !== 1) throw new Error("この発注は既に処理済みです");

  const result = await prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: id, seenFlag: false },
      data: { seenFlag: true },
    });

    // 発注ステータスは上の原子的クレームで REJECTED 済み。
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

  revalidatePath("/orders");
  revalidatePath("/sites");
  revalidatePath("/chat");
  return result;
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

  // 追加工事(別発注書)のキャンセルは、現場や他の発注に影響させない
  const isAdditional = (order.inspectionData as { type?: string } | null)?.type === "ADDITIONAL_ORDER";

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
    //    （本注文のキャンセルのみ。追加工事のキャンセルでは現場・他の発注を維持）
    if (!isAdditional) {
      await tx.factoryFloor.update({
        where: { id: order.factoryFloor.id },
        data: {
          status: "NOT_ORDERED",
          workCompanyId: null,
        },
      });
    }

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

  const result = await prisma.$transaction(async (tx) => {
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
  revalidatePath("/orders");
  revalidatePath("/sites");
  revalidatePath("/chat");
  return result;
}

// ============ V2: 発注確定（注文書自動生成） ============

export async function confirmOrder(orderId: string): Promise<{ success: boolean; error?: string; orderId?: string; documentId?: string }> {
  try {
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
  if (!order) return { success: false, error: "発注が見つかりません" };

  // 受注者の了承後のみ確定可能
  if (order.status !== "APPROVED") {
    return { success: false, error: `受注者が了承していない発注は確定できません（現在のステータス: ${order.status}）` };
  }

  // 二重送信対策: APPROVED のものだけを CONFIRMED に原子的に遷移し、確定処理を1リクエストに限定する。
  // これにより二重クリック/同時実行で注文書(ORDER_SHEET)が重複生成されるのを防ぐ。
  const claim = await prisma.factoryFloorOrder.updateMany({
    where: { id: orderId, status: "APPROVED", deletedAt: null },
    data: { status: "CONFIRMED" },
  });
  if (claim.count !== 1) {
    return { success: false, error: "この発注は既に確定済みです" };
  }

  // 注文書を先に生成（トランザクション外で実行しコネクションプール枯渇を防ぐ）
  let documentId: string;
  try {
    documentId = await generateOrderSheet(orderId);
  } catch (e) {
    // 原子的クレームを取り消して再試行可能に戻す
    await prisma.factoryFloorOrder.updateMany({
      where: { id: orderId, status: "CONFIRMED", deletedAt: null },
      data: { status: "APPROVED" },
    });
    console.error("[confirmOrder] generateOrderSheet failed:", e);
    return { success: false, error: "注文書の生成に失敗しました。もう一度お試しください。" };
  }

  await prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: orderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 発注ステータスは上の原子的クレームで CONFIRMED 済み。

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

  revalidatePath("/orders");
  revalidatePath("/sites");
  revalidatePath("/chat");
  return { success: true, orderId, documentId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
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

  // 二重送信対策: PENDING のものだけを APPROVED に原子的に遷移し、重複処理を防ぐ。
  const claim = await prisma.factoryFloorOrder.updateMany({
    where: { id: orderId, status: "PENDING", deletedAt: null },
    data: { status: "APPROVED" },
  });
  if (claim.count !== 1) throw new Error("この発注は既に処理済みです");

  const result = await prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: orderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 発注ステータスは上の原子的クレームで APPROVED 済み。現場ステータスを「発注済」に更新
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

  revalidatePath("/orders");
  revalidatePath("/sites");
  revalidatePath("/chat");
  return result;
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
  if (order.status !== "CONFIRMED") throw new Error("施工報告を送信できる状態ではありません");

  return prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: data.factoryFloorOrderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 施工報告(任意)を作成/更新。工事完了(締め)状態は変更しない。
    const reportData = {
      completionDate: new Date(data.completionDate),
      comment: data.comment,
      photos: data.photos,
      hasAdditionalWork: data.hasAdditionalWork ?? false,
      additionalWorkDescription: data.additionalWorkDescription,
      additionalWorkAmount: data.additionalWorkAmount ? BigInt(data.additionalWorkAmount) : null,
    };
    const report = await tx.completionReport.upsert({
      where: { factoryFloorOrderId: data.factoryFloorOrderId },
      create: { factoryFloorOrderId: data.factoryFloorOrderId, ...reportData },
      update: reportData,
    });

    // 発注者に通知（施工報告あり）
    const ordererUsers = await tx.user.findMany({
      where: { companyId: order.factoryFloor.companyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: "施工報告",
          content: `${order.factoryFloor.name}の施工報告が届きました。`,
          type: 22,
          factoryFloorId: order.factoryFloor.id,
          targetId: data.factoryFloorOrderId,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: "施工報告",
        body: `${order.factoryFloor.name}の施工報告が届きました。`,
        url: `/orders/${data.factoryFloorOrderId}/completion-report`,
      });
    }

    return report;
  });
}

// ============ V2: 工事完了画面のデータ取得（現場全体） ============

export async function getWorkCompletion(factoryFloorId: string) {
  const user = await requireSession();

  const floor = await prisma.factoryFloor.findFirst({
    where: {
      id: factoryFloorId,
      deletedAt: null,
      OR: [{ companyId: user.companyId }, { workCompanyId: user.companyId }],
    },
    select: {
      id: true,
      name: true,
      parent: { select: { name: true } },
      companyId: true,
      workCompanyId: true,
      status: true,
      orders: {
        where: { deletedAt: null, status: "CONFIRMED" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          completionStatus: true,
          completedDay: true,
          inspectionData: true,
          completionReport: { select: { id: true } },
          documents: {
            where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
            select: { id: true, documentNumber: true, totalAmount: true, metadata: true },
            orderBy: { issuedAt: "asc" },
          },
        },
      },
      // 初回発注の明細（追加工事は inspectionData 側を使う）
      priceDetails: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          name: true,
          quantity: true,
          priceUnit: true,
          specifications: true,
          unit: { select: { name: true } },
        },
      },
    },
  });
  if (!floor) return null;

  // 初回発注の明細（floorの価格明細）
  const floorItems = floor.priceDetails.map((d) => ({
    name: d.name,
    quantity: d.quantity,
    unitName: d.unit?.name ?? null,
    priceUnit: Number(d.priceUnit),
    amount: d.quantity * Number(d.priceUnit),
    specifications: d.specifications ?? null,
  }));

  return {
    id: floor.id,
    name: floor.name,
    parentName: floor.parent?.name ?? null,
    status: floor.status,
    isOrderer: floor.companyId === user.companyId,
    orders: floor.orders.map((o) => {
      const sheet = o.documents[0] ?? null;
      const insp = o.inspectionData as
        | {
            type?: string;
            priceDetails?: {
              name: string;
              quantity: number;
              unitId?: string;
              priceUnit: number;
              specifications?: string;
            }[];
          }
        | null;
      const isAdditional = insp?.type === "ADDITIONAL_ORDER";
      // 依頼の証左となる明細（初回=floor明細 / 追加=inspectionData明細）
      const items = isAdditional
        ? (insp?.priceDetails ?? []).map((d) => ({
            name: d.name,
            quantity: Number(d.quantity),
            unitName: typeof d.unitId === "string" ? d.unitId : null,
            priceUnit: Number(d.priceUnit),
            amount: Number(d.quantity) * Number(d.priceUnit),
            specifications: d.specifications ?? null,
          }))
        : floorItems;
      const subtotal = items.reduce((s, it) => s + it.amount, 0);
      return {
        id: o.id,
        completionStatus: o.completionStatus,
        completedDay: o.completedDay ? o.completedDay.toISOString() : null,
        hasReport: !!o.completionReport,
        isAdditional,
        items,
        subtotal,
        orderSheet: sheet
          ? {
              documentNumber: sheet.documentNumber,
              totalAmount: Number(sheet.totalAmount ?? 0),
              siteName: ((sheet.metadata as Record<string, unknown> | null)?.siteName as string) ?? null,
            }
          : null,
      };
    }),
  };
}

// ============ V2: 工事完了(締め)依頼（受注者・現場全体） ============

export async function requestCloseFloor(factoryFloorId: string) {
  const user = await requireSession();

  const floor = await prisma.factoryFloor.findFirst({
    where: { id: factoryFloorId, deletedAt: null, workCompanyId: user.companyId },
    select: {
      id: true,
      name: true,
      companyId: true,
      orders: {
        where: { deletedAt: null, status: "CONFIRMED" },
        select: { id: true, completionStatus: true, completionReport: { select: { id: true } } },
      },
    },
  });
  if (!floor) throw new Error("現場が見つかりません");

  const orders = floor.orders;
  if (orders.length === 0) throw new Error("対象の発注がありません");
  // 全発注書の施工報告が必須
  if (orders.some((o) => !o.completionReport)) {
    throw new Error("施工報告が未完了の工事があります。すべての施工報告を行ってください。");
  }
  const toRequest = orders.filter((o) => o.completionStatus === "NONE");
  if (toRequest.length === 0) throw new Error("既に締め依頼済み、または完了済みです");

  const result = await prisma.$transaction(async (tx) => {
    await tx.factoryFloorOrder.updateMany({
      where: { id: { in: toRequest.map((o) => o.id) } },
      data: { completionStatus: "CLOSE_REQUESTED" },
    });

    // SITE_INFO ルームにメッセージ
    const siteRoom = await tx.chatRoom.findFirst({
      where: { factoryFloorId: floor.id, type: "SITE_INFO", deletedAt: null },
    });
    if (siteRoom) {
      await tx.message.create({
        data: {
          roomId: siteRoom.id,
          userId: user.id,
          message: "工事の完了(締め)を依頼しました",
          type: "ACTION",
          actionType: "ORDER_REQUEST",
        },
      });
      await tx.chatRoom.update({ where: { id: siteRoom.id }, data: { lastMessageTime: new Date() } });
    }

    // 発注者に通知
    const ordererUsers = await tx.user.findMany({
      where: { companyId: floor.companyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: "工事完了の確認",
          content: `${floor.name}の工事完了(締め)の確認をお願いします。`,
          type: 37,
          factoryFloorId: floor.id,
          targetId: floor.id,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: "工事完了の確認",
        body: `${floor.name}の工事完了(締め)の確認をお願いします。`,
        url: `/work-completion/${floor.id}`,
      });
    }

    return { factoryFloorId: floor.id };
  });
  revalidatePath("/orders");
  revalidatePath("/sites");
  revalidatePath("/chat");
  return result;
}

// ============ V2: 工事完了(締め)承認（発注者・現場全体）→ 請求対象データ確定 ============

export async function approveCloseFloor(factoryFloorId: string, completedDay: string) {
  const user = await requireSession();

  if (!completedDay) throw new Error("工事完了日を入力してください");

  const floor = await prisma.factoryFloor.findFirst({
    where: { id: factoryFloorId, deletedAt: null, companyId: user.companyId },
    select: {
      id: true,
      name: true,
      finishDay: true,
      workCompanyId: true,
      orders: {
        where: { deletedAt: null, status: "CONFIRMED" },
        select: { id: true, completionStatus: true },
      },
    },
  });
  if (!floor) throw new Error("現場が見つかりません");

  const toClose = floor.orders.filter((o) => o.completionStatus === "CLOSE_REQUESTED");
  if (toClose.length === 0) throw new Error("承認できる状態ではありません");

  const completed = new Date(completedDay + "T00:00:00");

  const result = await prisma.$transaction(async (tx) => {
    // 相互評価は「初めての業者さんとの初めての工事」完了時のみ依頼する。
    // この受注者との過去の完了(CLOSED)取引がまだ無ければ初回とみなす
    // （この時点では toClose はまだ CLOSE_REQUESTED のため、CLOSED件数＝過去の取引数）。
    const priorClosedCount = floor.workCompanyId
      ? await tx.factoryFloorOrder.count({
          where: {
            deletedAt: null,
            completionStatus: "CLOSED",
            workCompanyId: floor.workCompanyId,
            factoryFloor: { companyId: user.companyId, deletedAt: null },
          },
        })
      : 0;
    const isFirstTransaction = priorClosedCount === 0;

    await tx.notification.updateMany({
      where: { userId: user.id, targetId: floor.id, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 締め依頼中の全発注書を完了に（この時点で注文書金額が請求対象データになる）
    await tx.factoryFloorOrder.updateMany({
      where: { id: { in: toClose.map((o) => o.id) } },
      data: { completionStatus: "CLOSED", completedDay: completed },
    });

    // 2. 現場 finishDay を更新(最大)＋ステータスロールアップ
    const existingFinish = floor.finishDay;
    const newFinish = !existingFinish || completed > existingFinish ? completed : existingFinish;
    const confirmedOrders = await tx.factoryFloorOrder.findMany({
      where: { factoryFloorId: floor.id, deletedAt: null, status: "CONFIRMED" },
      select: { completionStatus: true },
    });
    const allClosed = confirmedOrders.every((o) => o.completionStatus === "CLOSED");
    await tx.factoryFloor.update({
      where: { id: floor.id },
      data: { finishDay: newFinish, status: allClosed ? "COMPLETED" : "IN_PROGRESS" },
    });

    // 3. 受注者に「工事完了」通知
    const workCompanyId = floor.workCompanyId;
    if (workCompanyId) {
      const contractorUsers = await tx.user.findMany({
        where: { companyId: workCompanyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (contractorUsers.length > 0) {
        await tx.notification.createMany({
          data: contractorUsers.map((u) => ({
            userId: u.id,
            title: "工事完了",
            content: `${floor.name}の工事が完了しました。`,
            type: 38,
            factoryFloorId: floor.id,
            targetId: floor.id,
          })),
        });
        void sendPushToUsers({
          userIds: contractorUsers.map((u) => u.id),
          title: "工事完了",
          body: `${floor.name}の工事が完了しました。`,
          url: `/work-completion/${floor.id}`,
        });
      }
    }

    // 4. 双方に相互評価を依頼（初回取引のみ・評価ページは発注単位のため代表の発注IDを使用）
    if (isFirstTransaction) {
      const evalTargetOrderId = toClose[0].id;
      const evalCompanyIds = [user.companyId, workCompanyId].filter(Boolean) as string[];
      const evalUsers = await tx.user.findMany({
        where: { companyId: { in: evalCompanyIds }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (evalUsers.length > 0) {
        await tx.notification.createMany({
          data: evalUsers.map((u) => ({
            userId: u.id,
            title: "取引相手を評価してください",
            content: `${floor.name}の取引が完了しました。取引相手の評価をお願いします。`,
            type: 35,
            factoryFloorId: floor.id,
            targetId: evalTargetOrderId,
          })),
        });
      }
    }

    return { factoryFloorId: floor.id };
  });

  // 取引完了で双方の信用スコア（取引回数・金額・納期遵守・リピート率）を再計算する。
  // コミット後に実行（tx 内だと未コミットの締め状態が集計に反映されない）。
  await recalculateTrustScore(user.companyId);
  if (floor.workCompanyId) {
    await recalculateTrustScore(floor.workCompanyId);
  }

  revalidatePath("/orders");
  revalidatePath("/sites");
  return result;
}

// ============ V2: 工事完了(締め)の差し戻し（発注者・現場全体） ============

export async function rejectCloseFloor(factoryFloorId: string) {
  const user = await requireSession();

  const floor = await prisma.factoryFloor.findFirst({
    where: { id: factoryFloorId, deletedAt: null, companyId: user.companyId },
    select: {
      id: true,
      name: true,
      workCompanyId: true,
      orders: {
        where: { deletedAt: null, status: "CONFIRMED" },
        select: { id: true, completionStatus: true },
      },
    },
  });
  if (!floor) throw new Error("現場が見つかりません");

  const toRevert = floor.orders.filter((o) => o.completionStatus === "CLOSE_REQUESTED");
  if (toRevert.length === 0) throw new Error("差し戻しできる状態ではありません");

  const result = await prisma.$transaction(async (tx) => {
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: floor.id, seenFlag: false },
      data: { seenFlag: true },
    });

    // 締め依頼中の発注書を未締め(NONE)に戻す
    await tx.factoryFloorOrder.updateMany({
      where: { id: { in: toRevert.map((o) => o.id) } },
      data: { completionStatus: "NONE" },
    });

    // 受注者に差し戻し通知
    const workCompanyId = floor.workCompanyId;
    if (workCompanyId) {
      const contractorUsers = await tx.user.findMany({
        where: { companyId: workCompanyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (contractorUsers.length > 0) {
        await tx.notification.createMany({
          data: contractorUsers.map((u) => ({
            userId: u.id,
            title: "工事完了の差し戻し",
            content: `${floor.name}の工事完了が差し戻されました。内容を確認してください。`,
            type: 37,
            factoryFloorId: floor.id,
            targetId: floor.id,
          })),
        });
        void sendPushToUsers({
          userIds: contractorUsers.map((u) => u.id),
          title: "工事完了の差し戻し",
          body: `${floor.name}の工事完了が差し戻されました。`,
          url: `/work-completion/${floor.id}`,
        });
      }
    }

    return { factoryFloorId: floor.id };
  });
  revalidatePath("/orders");
  revalidatePath("/sites");
  return result;
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
          parent: { select: { code: true, name: true } },
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

// ============ 追加工事（3ステップ承認フロー） ============

/**
 * Step 1: 発注者が追加工事を依頼（PENDING）
 */
export async function createAdditionalOrder(
  factoryFloorId: string,
  items: { name: string; quantity: number; unitId?: string; priceUnit: number; specifications?: string }[],
  attachments?: { estimatePdfUrls?: string[]; imageUrls?: string[] },
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireSession();

    if (!items.length) return { success: false, error: "明細を入力してください" };

    const floor = await prisma.factoryFloor.findFirst({
      where: { id: factoryFloorId, deletedAt: null },
      select: { id: true, name: true, companyId: true, workCompanyId: true, status: true },
    });
    if (!floor) return { success: false, error: "現場が見つかりません" };
    if (floor.companyId !== user.companyId) return { success: false, error: "発注者のみ追加工事を登録できます" };
    if (floor.status !== "ORDERED" && floor.status !== "IN_PROGRESS") {
      return { success: false, error: "発注済み・施工中の現場のみ追加工事を登録できます" };
    }
    if (!floor.workCompanyId) return { success: false, error: "受注者が設定されていません" };

    // 新しい FactoryFloorOrder を PENDING で作成
    const newOrder = await prisma.factoryFloorOrder.create({
      data: {
        factoryFloorId,
        workCompanyId: floor.workCompanyId,
        status: "PENDING",
        inspectionData: {
          type: "ADDITIONAL_ORDER",
          priceDetails: items,
          estimatePdfUrls: attachments?.estimatePdfUrls ?? [],
          imageUrls: attachments?.imageUrls ?? [],
        },
      },
    });

    // SITE_INFO ルームにメッセージ + 受注者に通知
    await prisma.$transaction(async (tx) => {
      const siteRoom = await tx.chatRoom.findFirst({
        where: { factoryFloorId, type: "SITE_INFO", deletedAt: null },
      });
      if (!siteRoom) return;

      await tx.message.create({
        data: {
          roomId: siteRoom.id,
          userId: user.id,
          message: "追加工事の依頼がありました",
          type: "ACTION",
          actionType: "ORDER_REQUEST",
          factoryFloorOrderId: newOrder.id,
        },
      });
      await tx.chatRoom.update({
        where: { id: siteRoom.id },
        data: { lastMessageTime: new Date() },
      });

      // 受注者に通知
      const contractorUsers = await tx.user.findMany({
        where: { companyId: floor.workCompanyId!, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (contractorUsers.length > 0) {
        await tx.notification.createMany({
          data: contractorUsers.map((u) => ({
            userId: u.id,
            title: "追加工事依頼",
            content: `${floor.name}の追加工事依頼が届きました`,
            type: 32,
            factoryFloorId,
            targetId: newOrder.id,
          })),
        });
        void sendPushToUsers({
          userIds: contractorUsers.map((u) => u.id),
          title: "追加工事依頼",
          body: `${floor.name}の追加工事依頼が届きました`,
          url: `/orders/${newOrder.id}/additional-review`,
        });
      }
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Step 2: 受注者が追加工事を承諾（APPROVED）
 */
export async function acceptAdditionalOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireSession();

    const order = await prisma.factoryFloorOrder.findFirst({
      where: { id: orderId, deletedAt: null, workCompanyId: user.companyId },
      include: {
        factoryFloor: { select: { id: true, name: true, companyId: true } },
      },
    });
    if (!order) return { success: false, error: "発注が見つかりません" };
    if (order.status !== "PENDING") return { success: false, error: "この発注は既に処理済みです" };

    await prisma.$transaction(async (tx) => {
      await tx.notification.updateMany({
        where: { userId: user.id, targetId: orderId, seenFlag: false },
        data: { seenFlag: true },
      });

      await tx.factoryFloorOrder.update({
        where: { id: orderId },
        data: { status: "APPROVED" },
      });

      // SITE_INFO ルームにメッセージ
      const siteRoom = await tx.chatRoom.findFirst({
        where: { factoryFloorId: order.factoryFloor.id, type: "SITE_INFO", deletedAt: null },
      });
      if (siteRoom) {
        await tx.message.create({
          data: {
            roomId: siteRoom.id,
            userId: user.id,
            message: "追加工事を承諾しました",
            type: "ACTION",
            actionType: "ORDER_CONFIRM",
            factoryFloorOrderId: orderId,
          },
        });
        await tx.chatRoom.update({
          where: { id: siteRoom.id },
          data: { lastMessageTime: new Date() },
        });
      }

      // 発注者に通知
      const ordererUsers = await tx.user.findMany({
        where: { companyId: order.factoryFloor.companyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (ordererUsers.length > 0) {
        await tx.notification.createMany({
          data: ordererUsers.map((u) => ({
            userId: u.id,
            title: "追加工事承諾",
            content: `${order.factoryFloor.name}の追加工事が承諾されました。注文書を発行してください。`,
            type: 33,
            factoryFloorId: order.factoryFloor.id,
            targetId: orderId,
          })),
        });
        void sendPushToUsers({
          userIds: ordererUsers.map((u) => u.id),
          title: "追加工事承諾",
          body: `${order.factoryFloor.name}の追加工事が承諾されました。注文書を発行してください。`,
          url: `/orders/${orderId}/additional-review`,
        });
      }
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 受注者が追加工事を辞退（REJECTED）
 */
export async function rejectAdditionalOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireSession();

    const order = await prisma.factoryFloorOrder.findFirst({
      where: { id: orderId, deletedAt: null, workCompanyId: user.companyId },
      include: {
        factoryFloor: { select: { id: true, name: true, companyId: true } },
      },
    });
    if (!order) return { success: false, error: "発注が見つかりません" };
    if (order.status !== "PENDING") return { success: false, error: "この発注は既に処理済みです" };

    await prisma.$transaction(async (tx) => {
      await tx.factoryFloorOrder.update({
        where: { id: orderId },
        data: { status: "REJECTED" },
      });

      const siteRoom = await tx.chatRoom.findFirst({
        where: { factoryFloorId: order.factoryFloor.id, type: "SITE_INFO", deletedAt: null },
      });
      if (siteRoom) {
        await tx.message.create({
          data: {
            roomId: siteRoom.id,
            userId: user.id,
            message: "追加工事を辞退しました",
            type: "ACTION",
            actionType: "ORDER_REQUEST",
            factoryFloorOrderId: orderId,
          },
        });
        await tx.chatRoom.update({
          where: { id: siteRoom.id },
          data: { lastMessageTime: new Date() },
        });
      }

      // 発注者に通知
      const ordererUsers = await tx.user.findMany({
        where: { companyId: order.factoryFloor.companyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (ordererUsers.length > 0) {
        await tx.notification.createMany({
          data: ordererUsers.map((u) => ({
            userId: u.id,
            title: "追加工事辞退",
            content: `${order.factoryFloor.name}の追加工事が辞退されました`,
            type: 33,
            factoryFloorId: order.factoryFloor.id,
            targetId: orderId,
          })),
        });
      }
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Step 3: 発注者が追加工事を確定 → 注文書発行（CONFIRMED）
 */
export async function confirmAdditionalOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireSession();

    const order = await prisma.factoryFloorOrder.findFirst({
      where: {
        id: orderId,
        deletedAt: null,
        factoryFloor: { companyId: user.companyId, deletedAt: null },
      },
      include: {
        factoryFloor: { select: { id: true, name: true, workCompanyId: true } },
      },
    });
    if (!order) return { success: false, error: "発注が見つかりません" };
    if (order.status !== "APPROVED") return { success: false, error: "受注者が承諾していない追加工事は確定できません" };

    // 二重送信対策: APPROVED のものだけを原子的に CONFIRMED へ。重複した追加注文書の生成を防ぐ。
    const claim = await prisma.factoryFloorOrder.updateMany({
      where: { id: orderId, status: "APPROVED", deletedAt: null },
      data: { status: "CONFIRMED" },
    });
    if (claim.count !== 1) {
      return { success: false, error: "この追加工事は既に確定済みです" };
    }

    // 注文書を生成（トランザクション外）
    const documentId = await generateOrderSheet(orderId);

    await prisma.$transaction(async (tx) => {
      await tx.notification.updateMany({
        where: { userId: user.id, targetId: orderId, seenFlag: false },
        data: { seenFlag: true },
      });

      // 発注ステータスは上の原子的クレームで CONFIRMED 済み。

      // SITE_INFO ルームにメッセージ
      const siteRoom = await tx.chatRoom.findFirst({
        where: { factoryFloorId: order.factoryFloor.id, type: "SITE_INFO", deletedAt: null },
      });
      if (siteRoom) {
        await tx.message.create({
          data: {
            roomId: siteRoom.id,
            userId: user.id,
            message: "追加注文書が発行されました",
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
      }

      // 受注者に通知
      if (order.factoryFloor.workCompanyId) {
        const contractorUsers = await tx.user.findMany({
          where: { companyId: order.factoryFloor.workCompanyId, isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (contractorUsers.length > 0) {
          await tx.notification.createMany({
            data: contractorUsers.map((u) => ({
              userId: u.id,
              title: "追加工事確定",
              content: `${order.factoryFloor.name}の追加注文書が発行されました`,
              type: 24,
              factoryFloorId: order.factoryFloor.id,
              targetId: siteRoom?.id ?? orderId,
            })),
          });
          void sendPushToUsers({
            userIds: contractorUsers.map((u) => u.id),
            title: "追加工事確定",
            body: `${order.factoryFloor.name}の追加注文書が発行されました`,
            url: siteRoom ? `/chat/${siteRoom.id}` : `/orders/${orderId}`,
          });
        }
      }
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 追加工事の詳細取得
 */
export async function getAdditionalOrderDetail(orderId: string) {
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
        select: {
          id: true,
          name: true,
          companyId: true,
          workCompanyId: true,
          company: { select: { id: true, name: true } },
          workCompany: { select: { id: true, name: true } },
          parent: { select: { name: true } },
        },
      },
    },
  });

  if (!order) return null;

  // inspectionData から追加工事明細・添付(見積書PDF/画像)を取得
  type AdditionalOrderData = {
    type?: string;
    priceDetails?: { name: string; quantity: number; unitId?: string; priceUnit: number; specifications?: string }[];
    estimatePdfUrls?: string[];
    imageUrls?: string[];
  };
  const additionalData = order.inspectionData as AdditionalOrderData | null;
  const items = additionalData?.priceDetails ?? [];

  // unitId → unit 名を解決
  const unitIds = items.map((p) => p.unitId).filter(Boolean) as string[];
  const units = unitIds.length > 0
    ? await prisma.unit.findMany({ where: { id: { in: unitIds } } })
    : [];
  const unitMap = new Map(units.map((u) => [u.id, u.name]));

  const resolvedItems = items.map((p) => ({
    ...p,
    unitName: p.unitId ? (unitMap.get(p.unitId) ?? "") : "",
  }));

  return {
    ...order,
    additionalItems: resolvedItems,
    estimatePdfUrls: additionalData?.estimatePdfUrls ?? [],
    imageUrls: additionalData?.imageUrls ?? [],
    isOrderer: order.factoryFloor.companyId === user.companyId,
  };
}
