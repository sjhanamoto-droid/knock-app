"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { requireSession } from "@/lib/session";
import { requireKyc } from "@/lib/actions/verification";
import { generateOrderSheet } from "@/lib/services/document-generator";
import { sendPushToUsers } from "@/lib/push";
import { recalculateTrustScore } from "@/lib/services/trust-score";
import { toJstCalendarDate } from "@/lib/helpers/billing-period";
import { getInvoicedOrderIds } from "@/lib/helpers/invoiced-orders";

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
    //    （本注文のキャンセルのみ。追加工事のキャンセルでは他の発注を維持し、現場ステータスだけロールアップ）
    if (!isAdditional) {
      await tx.factoryFloor.update({
        where: { id: order.factoryFloor.id },
        data: {
          status: "NOT_ORDERED",
          workCompanyId: null,
        },
      });
    } else {
      // 追加工事のキャンセルで未回答の発注が無くなれば、現場を工事完了に戻す
      await rollupFloorCompletion(tx, order.factoryFloor.id);
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

  // 二重送信対策: PENDING のものだけを CONFIRMED に原子的に遷移し、重複処理を防ぐ。
  // 承諾＝注文書自動発行のため、従来の APPROVED（発注者の確定待ち）を経由せず一気に確定する。
  const claim = await prisma.factoryFloorOrder.updateMany({
    where: { id: orderId, status: "PENDING", deletedAt: null },
    data: { status: "CONFIRMED" },
  });
  if (claim.count !== 1) throw new Error("この発注は既に処理済みです");

  // 注文書を生成（トランザクション外で実行しコネクションプール枯渇を防ぐ）。
  // 失敗時は原子的クレームを取り消して再試行可能に戻す。
  let documentId: string;
  try {
    documentId = await generateOrderSheet(orderId);
  } catch (e) {
    await prisma.factoryFloorOrder.updateMany({
      where: { id: orderId, status: "CONFIRMED", deletedAt: null },
      data: { status: "PENDING" },
    });
    console.error("[acceptOrder] generateOrderSheet failed:", e);
    throw new Error("注文書の生成に失敗しました。もう一度お試しください。");
  }

  const orderCompanyId = order.factoryFloor.companyId;
  const workerCompanyId = order.workCompanyId; // = user.companyId

  const result = await prisma.$transaction(async (tx) => {
    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: orderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 発注ステータスは上の原子的クレームで CONFIRMED 済み。
    //    現場ステータスを施工中に更新（注文書発行 = 施工開始）
    await tx.factoryFloor.update({
      where: { id: order.factoryFloor.id },
      data: { status: "IN_PROGRESS" },
    });

    // 2. SITE_INFOチャットルームを作成（施工確定時に初めて作成）
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
          orderCompanyId,
          workerCompanyId,
          factoryFloorId: order.factoryFloor.id,
          type: "SITE_INFO",
          status: "OPEN",
          lastMessageTime: new Date(),
        },
      });

      // 両社のアクティブユーザーをメンバーに追加
      const allUsers = await tx.user.findMany({
        where: {
          companyId: { in: [orderCompanyId, workerCompanyId] },
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

    // 3. SITE_INFOルームに注文書発行のACTIONメッセージ
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

    // 4. 交渉ルーム（NEGOTIATION）に承認メッセージ
    const negoRoom = await tx.chatRoom.findFirst({
      where: {
        type: "NEGOTIATION",
        deletedAt: null,
        OR: [
          { orderCompanyId, workerCompanyId },
          { orderCompanyId: workerCompanyId, workerCompanyId: orderCompanyId },
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

    // 5. 発注者に通知（受注了承＋注文書発行済み → 現場ルームへ / type 24）
    const ordererUsers = await tx.user.findMany({
      where: { companyId: orderCompanyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: "受注了承",
          content: `${order.factoryFloor.name}が受注され、注文書が発行されました。`,
          type: 24,
          factoryFloorId: order.factoryFloor.id,
          targetId: siteRoom!.id,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: "受注了承",
        body: `${order.factoryFloor.name}が受注され、注文書が発行されました。`,
        url: `/chat/${siteRoom!.id}`,
      });
    }

    return { orderId, documentId };
  });

  revalidatePath("/orders");
  revalidatePath("/sites");
  revalidatePath("/chat");
  return result;
}

// ============ V2: 現場ステータスのロールアップ（発注書の完了状況 → 現場） ============

/**
 * 発注書(FactoryFloorOrder)の状態から現場ステータスを算出して反映する。
 * - 回答待ち(PENDING/APPROVED)の発注、または未完了(≠CLOSED)の確定発注が1つでもあれば「施工中」
 * - 確定発注がすべて完了(CLOSED)なら「工事完了」（finishDay = 最終の完了日）
 * 追加工事の依頼で 工事完了→施工中 に戻り、その施工報告で再び 工事完了 になる往復をここで担う。
 * 発注前(未発注/下書き/発注済)や取引終端(DEAL_COMPLETED)の現場は対象外。
 */
async function rollupFloorCompletion(tx: Prisma.TransactionClient, factoryFloorId: string) {
  const floor = await tx.factoryFloor.findUnique({
    where: { id: factoryFloorId },
    select: { status: true, finishDay: true },
  });
  if (!floor) return null;
  if (floor.status !== "IN_PROGRESS" && floor.status !== "COMPLETED") return floor.status;

  const orders = await tx.factoryFloorOrder.findMany({
    where: { factoryFloorId, deletedAt: null, status: { in: ["PENDING", "APPROVED", "CONFIRMED"] } },
    select: { status: true, completionStatus: true, completedDay: true },
  });
  const confirmed = orders.filter((o) => o.status === "CONFIRMED");
  const hasOpen = orders.some((o) => o.status !== "CONFIRMED" || o.completionStatus !== "CLOSED");
  const nextStatus = confirmed.length > 0 && !hasOpen ? "COMPLETED" : "IN_PROGRESS";

  // 現場の完了日 = 完了済み発注書の最終完了日
  const latestCompleted = confirmed
    .map((o) => o.completedDay)
    .filter((d): d is Date => !!d)
    .reduce<Date | null>((mx, d) => (!mx || d > mx ? d : mx), null);

  await tx.factoryFloor.update({
    where: { id: factoryFloorId },
    data: { status: nextStatus, finishDay: latestCompleted ?? floor.finishDay },
  });
  return nextStatus;
}

// ============ V2: 施工報告（受注者）＝発注書の完了・請求対象化 ============

export async function submitCompletionReport(data: {
  factoryFloorOrderId: string;
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
  if (order.completionStatus === "CLOSED") throw new Error("この発注書は既に完了しています");

  // 完了日 = 施工報告の送信日(JSTのカレンダー日付・時刻なし)。受注者は選択できず、
  // 請求月(発注者の締め日判定)と現場 finishDay(納期遵守判定)の基準になる。
  // 旧締め処理が保存していた「日付のみ」と同じ形に揃え、UTC 動作の本番で日付がずれないようにする。
  const completedAt = toJstCalendarDate();
  const ordererCompanyId = order.factoryFloor.companyId;

  const result = await prisma.$transaction(async (tx) => {
    // 二重送信対策: 未完了(≠CLOSED)の確定発注だけを原子的に完了(CLOSED)へ遷移し、重複処理を防ぐ。
    // この時点で注文書金額が完了月の請求対象データになる。
    const claim = await tx.factoryFloorOrder.updateMany({
      where: {
        id: data.factoryFloorOrderId,
        deletedAt: null,
        status: "CONFIRMED",
        completionStatus: { not: "CLOSED" },
      },
      data: { completionStatus: "CLOSED", completedDay: completedAt },
    });
    if (claim.count !== 1) throw new Error("この発注書は既に完了しています");

    // 相互評価は「初めての業者さんとの初めての工事」完了時のみ依頼する。
    // この発注者⇄受注者の完了(CLOSED)発注が今回の1件だけなら初回とみなす。
    const closedCount = await tx.factoryFloorOrder.count({
      where: {
        deletedAt: null,
        completionStatus: "CLOSED",
        workCompanyId: user.companyId,
        factoryFloor: { companyId: ordererCompanyId, deletedAt: null },
      },
    });
    const isFirstTransaction = closedCount === 1;

    // この発注に関連する通知を既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: data.factoryFloorOrderId, seenFlag: false },
      data: { seenFlag: true },
    });

    // 1. 施工報告を作成/更新
    const reportData = {
      completionDate: completedAt,
      comment: data.comment,
      photos: data.photos,
      hasAdditionalWork: data.hasAdditionalWork ?? false,
      additionalWorkDescription: data.additionalWorkDescription,
      additionalWorkAmount: data.additionalWorkAmount ? BigInt(data.additionalWorkAmount) : null,
    };
    await tx.completionReport.upsert({
      where: { factoryFloorOrderId: data.factoryFloorOrderId },
      create: { factoryFloorOrderId: data.factoryFloorOrderId, ...reportData },
      update: reportData,
    });

    // 2. 現場ステータスをロールアップ（全発注書が完了 → 工事完了）
    const floorStatus = await rollupFloorCompletion(tx, order.factoryFloor.id);
    const floorCompleted = floorStatus === "COMPLETED";

    // 3. SITE_INFO ルームにメッセージ
    const siteRoom = await tx.chatRoom.findFirst({
      where: { factoryFloorId: order.factoryFloor.id, type: "SITE_INFO", deletedAt: null },
    });
    if (siteRoom) {
      await tx.message.create({
        data: {
          roomId: siteRoom.id,
          userId: user.id,
          message: floorCompleted ? "施工報告が提出され、工事が完了しました" : "施工報告が提出されました",
          type: "ACTION",
          actionType: "ORDER_CONFIRM",
          factoryFloorOrderId: data.factoryFloorOrderId,
        },
      });
      await tx.chatRoom.update({ where: { id: siteRoom.id }, data: { lastMessageTime: new Date() } });
    }

    // 4. 発注者に通知（施工報告 → 施工報告画面）
    const content = floorCompleted
      ? `${order.factoryFloor.name}の施工報告が届き、工事が完了しました。`
      : `${order.factoryFloor.name}の施工報告が届きました。`;
    const ordererUsers = await tx.user.findMany({
      where: { companyId: ordererCompanyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: floorCompleted ? "工事完了" : "施工報告",
          content,
          type: 22,
          factoryFloorId: order.factoryFloor.id,
          targetId: data.factoryFloorOrderId,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: floorCompleted ? "工事完了" : "施工報告",
        body: content,
        url: `/orders/${data.factoryFloorOrderId}/completion-report`,
      });
    }

    // 5. 双方に相互評価を依頼（初回取引のみ・評価ページは発注単位）
    if (isFirstTransaction) {
      const evalUsers = await tx.user.findMany({
        where: { companyId: { in: [ordererCompanyId, user.companyId] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (evalUsers.length > 0) {
        await tx.notification.createMany({
          data: evalUsers.map((u) => ({
            userId: u.id,
            title: "取引相手を評価してください",
            content: `${order.factoryFloor.name}の取引が完了しました。取引相手の評価をお願いします。`,
            type: 35,
            factoryFloorId: order.factoryFloor.id,
            targetId: data.factoryFloorOrderId,
          })),
        });
      }
    }

    return { success: true as const, floorCompleted };
  });

  // 取引完了で双方の信用スコア（取引回数・金額・納期遵守・リピート率）を再計算する。
  // コミット後に実行（tx 内だと未コミットの完了状態が集計に反映されない）。
  // 完了自体は確定済みなので、スコア再計算の失敗で送信をエラーにしない（次の完了時に追いつく）。
  try {
    await Promise.all([recalculateTrustScore(ordererCompanyId), recalculateTrustScore(user.companyId)]);
  } catch (e) {
    console.error("[submitCompletionReport] recalculateTrustScore failed:", e);
  }

  revalidatePath("/orders");
  revalidatePath("/sites");
  revalidatePath("/chat");
  return result;
}

// ============ V2: 施工報告の差し戻し（発注者）＝完了の取り消し ============

/**
 * 発注者が完了(CLOSED)した発注書を未完了(NONE)に戻す。誤送信時の逃げ道。
 * 請求書(非VOID)に含まれている発注書は差し戻せない（先に請求書側を無効にする）。
 * 施工報告の内容は残し、受注者は修正して再送信できる（再送信で再び完了になる）。
 */
export async function revertCompletion(orderId: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      factoryFloor: { companyId: user.companyId, deletedAt: null },
    },
    include: {
      factoryFloor: { select: { id: true, name: true } },
    },
  });
  if (!order) throw new Error("発注が見つかりません");
  if (order.status !== "CONFIRMED" || order.completionStatus !== "CLOSED") {
    throw new Error("差し戻せる状態ではありません");
  }

  const invoicedOrderIds = await getInvoicedOrderIds({ orderCompanyId: user.companyId });
  if (invoicedOrderIds.has(orderId)) {
    throw new Error("この発注書は請求書に含まれているため差し戻せません。先に請求書を無効にしてください。");
  }

  const workCompanyId = order.workCompanyId;

  const result = await prisma.$transaction(async (tx) => {
    // 二重操作対策: 完了(CLOSED)のものだけを原子的に未完了へ戻す
    const claim = await tx.factoryFloorOrder.updateMany({
      where: { id: orderId, deletedAt: null, status: "CONFIRMED", completionStatus: "CLOSED" },
      data: { completionStatus: "NONE", completedDay: null },
    });
    if (claim.count !== 1) throw new Error("この発注書は既に差し戻し済みです");

    // 現場ステータスをロールアップ（工事完了 → 施工中）
    await rollupFloorCompletion(tx, order.factoryFloor.id);

    // SITE_INFO ルームにメッセージ
    const siteRoom = await tx.chatRoom.findFirst({
      where: { factoryFloorId: order.factoryFloor.id, type: "SITE_INFO", deletedAt: null },
    });
    if (siteRoom) {
      await tx.message.create({
        data: {
          roomId: siteRoom.id,
          userId: user.id,
          message: "施工報告が差し戻されました",
          type: "ACTION",
          actionType: "ORDER_REQUEST",
          factoryFloorOrderId: orderId,
        },
      });
      await tx.chatRoom.update({ where: { id: siteRoom.id }, data: { lastMessageTime: new Date() } });
    }

    // 受注者に通知（→ 施工報告画面で修正・再送信）
    const contractorUsers = await tx.user.findMany({
      where: { companyId: workCompanyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (contractorUsers.length > 0) {
      const content = `${order.factoryFloor.name}の施工報告が差し戻されました。内容を確認して再送信してください。`;
      await tx.notification.createMany({
        data: contractorUsers.map((u) => ({
          userId: u.id,
          title: "施工報告の差し戻し",
          content,
          type: 22,
          factoryFloorId: order.factoryFloor.id,
          targetId: orderId,
        })),
      });
      void sendPushToUsers({
        userIds: contractorUsers.map((u) => u.id),
        title: "施工報告の差し戻し",
        body: content,
        url: `/orders/${orderId}/completion-report`,
      });
    }

    return { success: true as const };
  });

  // 完了件数が変わるので双方の信用スコアを再計算（失敗しても差し戻し自体は確定）
  try {
    await Promise.all([recalculateTrustScore(user.companyId), recalculateTrustScore(workCompanyId)]);
  } catch (e) {
    console.error("[revertCompletion] recalculateTrustScore failed:", e);
  }

  revalidatePath("/orders");
  revalidatePath("/sites");
  revalidatePath("/chat");
  return result;
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
      // 回答待ち(PENDING/APPROVED)の発注も返す。現場ステータスのロールアップと同じ集合で、
      // 追加工事の依頼中に「工事完了」と表示されないようにする。
      orders: {
        where: { deletedAt: null, status: { in: ["PENDING", "APPROVED", "CONFIRMED"] } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
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
        status: o.status,
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
    // 工事完了後でも追加工事は依頼できる（依頼で現場は施工中に戻り、追加分の施工報告で再び工事完了になる）
    if (floor.status !== "ORDERED" && floor.status !== "IN_PROGRESS" && floor.status !== "COMPLETED") {
      return { success: false, error: "発注済み・施工中・工事完了の現場のみ追加工事を登録できます" };
    }
    if (!floor.workCompanyId) return { success: false, error: "受注者が設定されていません" };

    // 発注作成 + 現場ステータス更新 + SITE_INFO ルームにメッセージ + 受注者に通知（1トランザクション）
    await prisma.$transaction(async (tx) => {
      // 新しい FactoryFloorOrder を PENDING で作成
      const newOrder = await tx.factoryFloorOrder.create({
        data: {
          factoryFloorId,
          workCompanyId: floor.workCompanyId!,
          status: "PENDING",
          inspectionData: {
            type: "ADDITIONAL_ORDER",
            priceDetails: items,
            estimatePdfUrls: attachments?.estimatePdfUrls ?? [],
            imageUrls: attachments?.imageUrls ?? [],
          },
        },
      });

      // 工事完了後の追加工事: 現場を施工中に戻す（発注作成と同じトランザクションで確定させる）
      if (floor.status === "COMPLETED") {
        await tx.factoryFloor.update({
          where: { id: factoryFloorId },
          data: { status: "IN_PROGRESS" },
        });
      }

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

    // 二重送信対策: PENDING → CONFIRMED（承諾＝追加注文書を自動発行）。
    // 従来の APPROVED（発注者の確定待ち）を経由しない。
    const claim = await prisma.factoryFloorOrder.updateMany({
      where: { id: orderId, status: "PENDING", deletedAt: null },
      data: { status: "CONFIRMED" },
    });
    if (claim.count !== 1) return { success: false, error: "この発注は既に処理済みです" };

    // 追加注文書を生成（トランザクション外・失敗時はロールバック）
    let documentId: string;
    try {
      documentId = await generateOrderSheet(orderId);
    } catch (e) {
      await prisma.factoryFloorOrder.updateMany({
        where: { id: orderId, status: "CONFIRMED", deletedAt: null },
        data: { status: "PENDING" },
      });
      console.error("[acceptAdditionalOrder] generateOrderSheet failed:", e);
      return { success: false, error: "追加注文書の生成に失敗しました。もう一度お試しください。" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.notification.updateMany({
        where: { userId: user.id, targetId: orderId, seenFlag: false },
        data: { seenFlag: true },
      });

      // 発注ステータスは上の原子的クレームで CONFIRMED 済み。

      // SITE_INFO ルームに追加注文書発行のメッセージ
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

      // 発注者に通知（追加注文書発行済み → 現場ルームへ / type 24）
      const ordererUsers = await tx.user.findMany({
        where: { companyId: order.factoryFloor.companyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (ordererUsers.length > 0) {
        await tx.notification.createMany({
          data: ordererUsers.map((u) => ({
            userId: u.id,
            title: "追加工事承諾",
            content: `${order.factoryFloor.name}の追加工事が承諾され、追加注文書が発行されました。`,
            type: 24,
            factoryFloorId: order.factoryFloor.id,
            targetId: siteRoom?.id ?? orderId,
          })),
        });
        void sendPushToUsers({
          userIds: ordererUsers.map((u) => u.id),
          title: "追加工事承諾",
          body: `${order.factoryFloor.name}の追加工事が承諾され、追加注文書が発行されました。`,
          url: siteRoom ? `/chat/${siteRoom.id}` : `/orders/${orderId}`,
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

      // 辞退で未回答の追加工事が無くなれば、現場を工事完了に戻す
      await rollupFloorCompletion(tx, order.factoryFloor.id);

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
      // 未完了の確定発注が増えるので現場ステータスをロールアップ（工事完了 → 施工中）
      await rollupFloorCompletion(tx, order.factoryFloor.id);

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
