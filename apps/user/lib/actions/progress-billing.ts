"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { requireSession } from "@/lib/session";
import { sendPushToUsers } from "@/lib/push";
import { recalculateTrustScore } from "@/lib/services/trust-score";
import { toJstCalendarDate } from "@/lib/helpers/billing-period";
import { rollupFloorCompletion } from "@/lib/helpers/floor-rollup";
import {
  summarizeProgress,
  progressLabel,
  jstYearMonth,
  type ProgressKind,
  type ProgressStatus,
} from "@/lib/helpers/progress-billing";

// ============ 出来高（発注書ごとの部分完了）: 受注者の報告 → 発注者の確定/差し戻し ============
//
// - 受注者が終わった分の金額(税抜)を報告(PENDING) → 発注者が確定(CONFIRMED)すると申請月の請求対象
// - 確定待ちの間は同じ発注書で次の報告はできない。送信後(確定前)の取り消し・修正は不可
// - 差し戻し(RETURNED)の履歴は残す。再送信の請求月は差し戻された出来高の申請月を引き継ぐ
// - 残額すべて(FINAL)が確定した時点で発注書は完了(CLOSED)

const yen = (n: number) => `¥${n.toLocaleString()}`;

/** 発注書の行ロック。報告・確定・差し戻しを発注書単位で直列化し、二重送信/二重確定を防ぐ */
async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT id FROM factory_floor_orders WHERE id = ${orderId} FOR UPDATE`;
}

/** 注文書金額（税抜）= 非VOIDの注文書の小計 */
function orderSheetSubtotal(docs: { subtotal: bigint | null }[]): number {
  return docs.reduce((s, d) => s + Number(d.subtotal ?? 0), 0);
}

type ItemRow = {
  amount: bigint;
  status: ProgressStatus;
  kind: ProgressKind;
  appliedAt: Date;
  billingMonth: string;
};

function toSummaryItems(items: ItemRow[]) {
  return items.map((i) => ({
    amount: Number(i.amount),
    status: i.status,
    kind: i.kind,
    appliedAt: i.appliedAt,
  }));
}

/** 次に申請する出来高の請求月。差し戻し後の再送信は元の申請月を引き継ぐ */
function nextBillingMonth(items: ItemRow[]): string {
  const latest = [...items].sort((a, b) => +b.appliedAt - +a.appliedAt)[0];
  return latest?.status === "RETURNED" ? latest.billingMonth : jstYearMonth();
}

/**
 * 出来高画面（報告/確定/履歴）の表示データ。発注書の受注者・発注者のみ取得できる。
 */
export async function getProgressContext(orderId: string) {
  const user = await requireSession();

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      OR: [{ workCompanyId: user.companyId }, { factoryFloor: { companyId: user.companyId } }],
    },
    select: {
      id: true,
      status: true,
      completionStatus: true,
      workCompanyId: true,
      inspectionData: true,
      factoryFloor: {
        select: {
          id: true,
          name: true,
          companyId: true,
          parent: { select: { name: true } },
          company: { select: { name: true } },
          workCompany: { select: { name: true } },
          orders: {
            where: { deletedAt: null, status: { in: ["PENDING", "APPROVED", "CONFIRMED"] } },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          },
        },
      },
      documents: {
        where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
        orderBy: { issuedAt: "asc" },
        select: { documentNumber: true, subtotal: true },
      },
      progressBillings: {
        orderBy: { appliedAt: "asc" },
        select: {
          id: true,
          appliedAt: true,
          billingMonth: true,
          amount: true,
          kind: true,
          status: true,
          comment: true,
          photos: true,
          confirmedAt: true,
          returnedAt: true,
        },
      },
    },
  });
  if (!order) return null;

  const floor = order.factoryFloor;
  const isOrderer = floor.companyId === user.companyId;
  const isAdditional = (order.inspectionData as { type?: string } | null)?.type === "ADDITIONAL_ORDER";
  const index = floor.orders.findIndex((o) => o.id === order.id);
  const orderAmount = orderSheetSubtotal(order.documents);
  const summary = summarizeProgress(
    orderAmount,
    toSummaryItems(order.progressBillings),
    order.completionStatus === "CLOSED",
  );

  return {
    orderId: order.id,
    floorId: floor.id,
    floorName: floor.name ?? "",
    parentName: floor.parent?.name ?? null,
    ordererName: floor.company?.name ?? "",
    workerName: floor.workCompany?.name ?? "",
    isOrderer,
    orderLabel: isAdditional ? "追加工事" : `発注書 ${index >= 0 ? index + 1 : 1}`,
    documentNumber: order.documents[0]?.documentNumber ?? null,
    orderConfirmed: order.status === "CONFIRMED",
    closed: order.completionStatus === "CLOSED",
    orderAmount,
    summary,
    nextBillingMonth: nextBillingMonth(order.progressBillings),
    items: order.progressBillings.map((p) => ({
      id: p.id,
      appliedAt: p.appliedAt.toISOString(),
      billingMonth: p.billingMonth,
      amount: Number(p.amount),
      kind: p.kind,
      status: p.status,
      comment: p.comment,
      photos: (p.photos as string[] | null) ?? [],
      confirmedAt: p.confirmedAt?.toISOString() ?? null,
      returnedAt: p.returnedAt?.toISOString() ?? null,
    })),
  };
}

/**
 * 受注者: 出来高を送信する（取り消し不可）。
 * - final=true: 残りすべて（金額＝残額で固定。expectedAmount と残額が一致しなければエラー）
 * - final=false: 1円〜残額。残額と同額なら最終(FINAL)として扱う
 * サーバー側でも残額を再チェックし、確定待ちがある間は受け付けない。
 */
export async function submitProgressBilling(data: {
  orderId: string;
  amount: number;
  final: boolean;
  comment?: string;
  photos: string[];
}) {
  const user = await requireSession();

  const amount = Number(data.amount);
  if (!Number.isInteger(amount) || amount < 1) throw new Error("金額を入力してください");

  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: data.orderId,
      deletedAt: null,
      workCompanyId: user.companyId,
      factoryFloor: { deletedAt: null },
    },
    select: {
      id: true,
      status: true,
      completionStatus: true,
      factoryFloor: {
        select: { id: true, name: true, companyId: true, workCompany: { select: { name: true } } },
      },
    },
  });
  if (!order) throw new Error("発注書が見つかりません");
  if (order.status !== "CONFIRMED") throw new Error("出来高を報告できる状態ではありません");
  if (order.completionStatus === "CLOSED") throw new Error("この発注書は既に完了しています");

  const floor = order.factoryFloor;

  const created = await prisma.$transaction(async (tx) => {
    await lockOrder(tx, order.id);

    const current = await tx.factoryFloorOrder.findUniqueOrThrow({
      where: { id: order.id },
      select: {
        completionStatus: true,
        documents: {
          where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
          select: { subtotal: true },
        },
        progressBillings: {
          select: { amount: true, status: true, kind: true, appliedAt: true, billingMonth: true },
        },
      },
    });
    if (current.completionStatus === "CLOSED") throw new Error("この発注書は既に完了しています");
    if (current.documents.length === 0) throw new Error("注文書がないため出来高を報告できません");

    const orderAmount = orderSheetSubtotal(current.documents);
    const summary = summarizeProgress(orderAmount, toSummaryItems(current.progressBillings));
    if (summary.pending > 0) {
      throw new Error("確定待ちの出来高があります。確定または差し戻しをお待ちください");
    }
    if (summary.remaining <= 0) throw new Error("残りの金額がありません");
    if (data.final && amount !== summary.remaining) throw new Error("金額を確認してください");
    if (amount > summary.remaining) {
      throw new Error(`金額を確認してください（${yen(summary.remaining)} 以内）`);
    }

    const kind: ProgressKind = amount === summary.remaining ? "FINAL" : "PARTIAL";
    const billingMonth = nextBillingMonth(current.progressBillings);

    const item = await tx.progressBilling.create({
      data: {
        factoryFloorOrderId: order.id,
        billingMonth,
        amount: BigInt(amount),
        kind,
        status: "PENDING",
        comment: data.comment?.trim() || null,
        photos: data.photos ?? [],
        appliedByUserId: user.id,
      },
    });

    const label = progressLabel(billingMonth);

    // 現場情報ルームに記録
    const siteRoom = await tx.chatRoom.findFirst({
      where: { factoryFloorId: floor.id, type: "SITE_INFO", deletedAt: null },
    });
    if (siteRoom) {
      await tx.message.create({
        data: {
          roomId: siteRoom.id,
          userId: user.id,
          message: `${label} ${yen(amount)}（税抜）の確定依頼が届きました`,
          type: "ACTION",
          actionType: "ORDER_REQUEST",
          factoryFloorOrderId: order.id,
        },
      });
      await tx.chatRoom.update({ where: { id: siteRoom.id }, data: { lastMessageTime: new Date() } });
    }

    // 受注者側の差し戻し通知などは既読にする
    await tx.notification.updateMany({
      where: { userId: user.id, factoryFloorId: floor.id, type: { in: [45, 46] }, seenFlag: false },
      data: { seenFlag: true },
    });

    // 発注者に「出来高の確定依頼」（→ 出来高の確定画面）
    const ordererUsers = await tx.user.findMany({
      where: { companyId: floor.companyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      const content = `${floor.workCompany?.name ?? "受注者"}から${floor.name ?? ""}の${label} ${yen(amount)}（税抜）の確定依頼が届きました。`;
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: "出来高の確定依頼",
          content,
          type: 44,
          factoryFloorId: floor.id,
          targetId: order.id,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: "出来高の確定依頼",
        body: content,
        url: `/orders/${order.id}/progress`,
      });
    }

    return { id: item.id, kind, billingMonth };
  });

  revalidatePath("/sites");
  revalidatePath("/chat");
  revalidatePath(`/work-completion/${floor.id}`);
  return { success: true as const, ...created };
}

/** 発注者が操作できる確定待ちの出来高を取得（権限チェック込み） */
async function findPendingForOrderer(progressId: string, companyId: string) {
  const item = await prisma.progressBilling.findFirst({
    where: {
      id: progressId,
      factoryFloorOrder: { deletedAt: null, factoryFloor: { companyId, deletedAt: null } },
    },
    select: {
      id: true,
      status: true,
      factoryFloorOrderId: true,
      factoryFloorOrder: {
        select: {
          workCompanyId: true,
          factoryFloor: { select: { id: true, name: true, companyId: true, company: { select: { name: true } } } },
        },
      },
    },
  });
  if (!item) throw new Error("出来高が見つかりません");
  if (item.status !== "PENDING") throw new Error("この出来高は既に確定または差し戻し済みです");
  return item;
}

/**
 * 発注者: 確定待ちの出来高を確定する。確定した金額は申請月の請求対象になる。
 * 最終(残額すべて)の確定で発注書は完了(CLOSED)になり、既存の完了処理（現場ロールアップ・
 * 施工報告の記録・初回取引の相互評価依頼・信用スコア再計算）を行う。
 */
export async function confirmProgressBilling(progressId: string) {
  const user = await requireSession();
  const found = await findPendingForOrderer(progressId, user.companyId);
  const orderId = found.factoryFloorOrderId;
  const floor = found.factoryFloorOrder.factoryFloor;
  const workCompanyId = found.factoryFloorOrder.workCompanyId;

  const result = await prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);

    // 二重確定対策: 確定待ちのものだけを原子的に確定へ
    const claim = await tx.progressBilling.updateMany({
      where: { id: progressId, status: "PENDING" },
      data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedByUserId: user.id },
    });
    if (claim.count !== 1) throw new Error("この出来高は既に確定または差し戻し済みです");

    const item = await tx.progressBilling.findUniqueOrThrow({ where: { id: progressId } });
    const order = await tx.factoryFloorOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        status: true,
        completionStatus: true,
        deletedAt: true,
        documents: {
          where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
          select: { subtotal: true },
        },
        progressBillings: { select: { amount: true, status: true, kind: true, appliedAt: true, billingMonth: true } },
      },
    });
    // ロック取得後に発注書の状態を再確認（取消・削除された発注書や、施工報告で完了済みの発注書は確定しない）
    if (order.deletedAt || order.status !== "CONFIRMED" || order.completionStatus === "CLOSED") {
      throw new Error("この発注書は確定できる状態ではありません");
    }
    const summary = summarizeProgress(orderSheetSubtotal(order.documents), toSummaryItems(order.progressBillings));
    const completesOrder = item.kind === "FINAL" || summary.remaining === 0;
    const label = progressLabel(item.billingMonth);
    const amount = Number(item.amount);

    let floorCompleted = false;
    let isFirstTransaction = false;
    if (completesOrder) {
      // 完了日 = 最終の出来高の申請日（施工報告の送信日＝完了日と同じ考え方）
      const completedAt = toJstCalendarDate(item.appliedAt);
      await tx.factoryFloorOrder.update({
        where: { id: orderId },
        data: { completionStatus: "CLOSED", completedDay: completedAt },
      });
      // 施工報告として最終の出来高の内容を残す（既存の「施工報告を確認」画面・ホームの完了カード用）
      const reportData = {
        completionDate: completedAt,
        comment: item.comment,
        photos: (item.photos as string[] | null) ?? [],
      };
      await tx.completionReport.upsert({
        where: { factoryFloorOrderId: orderId },
        create: { factoryFloorOrderId: orderId, ...reportData },
        update: reportData,
      });
      floorCompleted = (await rollupFloorCompletion(tx, floor.id)) === "COMPLETED";

      const closedCount = await tx.factoryFloorOrder.count({
        where: {
          deletedAt: null,
          completionStatus: "CLOSED",
          workCompanyId,
          factoryFloor: { companyId: floor.companyId, deletedAt: null },
        },
      });
      isFirstTransaction = closedCount === 1;
    }

    // この出来高の確定依頼通知を既読に
    await tx.notification.updateMany({
      where: { userId: user.id, targetId: orderId, type: 44, seenFlag: false },
      data: { seenFlag: true },
    });

    const siteRoom = await tx.chatRoom.findFirst({
      where: { factoryFloorId: floor.id, type: "SITE_INFO", deletedAt: null },
    });
    if (siteRoom) {
      await tx.message.create({
        data: {
          roomId: siteRoom.id,
          userId: user.id,
          message: completesOrder
            ? `${label} ${yen(amount)}（税抜）が確定し、発注書が完了しました`
            : `${label} ${yen(amount)}（税抜）が確定しました`,
          type: "ACTION",
          actionType: "ORDER_CONFIRM",
          factoryFloorOrderId: orderId,
        },
      });
      await tx.chatRoom.update({ where: { id: siteRoom.id }, data: { lastMessageTime: new Date() } });
    }

    // 受注者へ通知（確定 → 工事完了画面 / 最終の確定 → 既存の工事完了通知）
    const contractorUsers = await tx.user.findMany({
      where: { companyId: workCompanyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (contractorUsers.length > 0) {
      const title = completesOrder ? "工事完了" : "出来高が確定しました";
      const content = completesOrder
        ? `${floor.name ?? ""}の${label} ${yen(amount)}（税抜）が確定し、発注書が完了しました。`
        : `${floor.name ?? ""}の${label} ${yen(amount)}（税抜）が確定しました。${summary.remaining > 0 ? `残り ${yen(summary.remaining)}（税抜）。` : ""}`;
      await tx.notification.createMany({
        data: contractorUsers.map((u) => ({
          userId: u.id,
          title,
          content,
          type: completesOrder ? 38 : 45,
          factoryFloorId: floor.id,
          targetId: floor.id,
        })),
      });
      void sendPushToUsers({
        userIds: contractorUsers.map((u) => u.id),
        title,
        body: content,
        url: `/work-completion/${floor.id}`,
      });
    }

    // 初回取引の完了なら双方に相互評価を依頼（施工報告での完了と同じ）
    if (isFirstTransaction) {
      const evalUsers = await tx.user.findMany({
        where: { companyId: { in: [floor.companyId, workCompanyId] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (evalUsers.length > 0) {
        await tx.notification.createMany({
          data: evalUsers.map((u) => ({
            userId: u.id,
            title: "取引相手を評価してください",
            content: `${floor.name ?? ""}の取引が完了しました。取引相手の評価をお願いします。`,
            type: 35,
            factoryFloorId: floor.id,
            targetId: orderId,
          })),
        });
      }
    }

    return { success: true as const, completesOrder, floorCompleted, remaining: summary.remaining };
  });

  if (result.completesOrder) {
    try {
      await Promise.all([recalculateTrustScore(user.companyId), recalculateTrustScore(workCompanyId)]);
    } catch (e) {
      console.error("[confirmProgressBilling] recalculateTrustScore failed:", e);
    }
  }

  revalidatePath("/sites");
  revalidatePath("/chat");
  revalidatePath("/billing");
  revalidatePath(`/work-completion/${floor.id}`);
  return result;
}

/**
 * 発注者: 確定待ちの出来高を差し戻す。出来高は未確定に戻り、請求対象から外れる。
 * 差し戻した履歴は残し、受注者は修正して再送信できる。
 */
export async function returnProgressBilling(progressId: string) {
  const user = await requireSession();
  const found = await findPendingForOrderer(progressId, user.companyId);
  const orderId = found.factoryFloorOrderId;
  const floor = found.factoryFloorOrder.factoryFloor;
  const workCompanyId = found.factoryFloorOrder.workCompanyId;

  await prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const claim = await tx.progressBilling.updateMany({
      where: { id: progressId, status: "PENDING" },
      data: { status: "RETURNED", returnedAt: new Date(), returnedByUserId: user.id },
    });
    if (claim.count !== 1) throw new Error("この出来高は既に確定または差し戻し済みです");

    const item = await tx.progressBilling.findUniqueOrThrow({
      where: { id: progressId },
      select: { billingMonth: true, amount: true },
    });
    const label = progressLabel(item.billingMonth);

    await tx.notification.updateMany({
      where: { userId: user.id, targetId: orderId, type: 44, seenFlag: false },
      data: { seenFlag: true },
    });

    const siteRoom = await tx.chatRoom.findFirst({
      where: { factoryFloorId: floor.id, type: "SITE_INFO", deletedAt: null },
    });
    if (siteRoom) {
      await tx.message.create({
        data: {
          roomId: siteRoom.id,
          userId: user.id,
          message: `${label}が差し戻されました`,
          type: "ACTION",
          actionType: "ORDER_REQUEST",
          factoryFloorOrderId: orderId,
        },
      });
      await tx.chatRoom.update({ where: { id: siteRoom.id }, data: { lastMessageTime: new Date() } });
    }

    const contractorUsers = await tx.user.findMany({
      where: { companyId: workCompanyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (contractorUsers.length > 0) {
      const content = `${floor.name ?? ""}の${label}が差し戻されました。内容を確認して再送信してください。`;
      await tx.notification.createMany({
        data: contractorUsers.map((u) => ({
          userId: u.id,
          title: "出来高の差し戻し",
          content,
          type: 46,
          factoryFloorId: floor.id,
          targetId: floor.id,
        })),
      });
      void sendPushToUsers({
        userIds: contractorUsers.map((u) => u.id),
        title: "出来高の差し戻し",
        body: content,
        url: `/work-completion/${floor.id}`,
      });
    }
  });

  revalidatePath("/sites");
  revalidatePath("/chat");
  revalidatePath(`/work-completion/${floor.id}`);
  return { success: true as const };
}
