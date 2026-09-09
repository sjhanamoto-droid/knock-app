"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";

/**
 * 運営による「発注書の完了日（＝請求月の基準日）」の調整。
 *
 * ユーザーアプリでは受注者が施工報告を送信した日で完了日が自動確定する（受注者は選べない）。
 * 締め日をまたいで提出された等の理由で「前月分として請求したい」という要望が運営に来るため、
 * DBを直接触らずにこの画面から変更できるようにする。
 * - 変更できるのは確定(CONFIRMED)かつ完了(CLOSED)の発注書のみ
 * - すでに請求書(非VOID)に含まれている発注書は変更不可（先に請求書側を無効にする）
 * - 完了日の変更にあわせて、現場の完了日(finishDay)と施工報告の施工完了日も揃える
 */

/** 締め月の判定。apps/user/lib/helpers/billing-period.ts の getBillingMonth と同じ規則（月末締め=null、N日締め） */
function billingMonthOf(completedDay: Date, closingDay: number | null | undefined): string {
  const y = completedDay.getFullYear();
  const m = completedDay.getMonth() + 1;
  if (closingDay == null) return `${y}${String(m).padStart(2, "0")}`;
  const n = Math.min(28, Math.max(1, Math.trunc(closingDay)));
  if (completedDay.getDate() <= n) return `${y}${String(m).padStart(2, "0")}`;
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}`;
}

/** 非VOIDの請求書に含まれている発注ID（請求書 metadata.orderIds が唯一の真実） */
async function getInvoicedOrderIdSet(): Promise<Set<string>> {
  const invoices = await prisma.document.findMany({
    where: { type: "INVOICE", deletedAt: null, status: { not: "VOID" } },
    select: { metadata: true, documentNumber: true },
  });
  const ids = new Set<string>();
  for (const inv of invoices) {
    const meta = inv.metadata as Record<string, unknown> | null;
    for (const id of (meta?.orderIds as string[]) ?? []) ids.add(id);
  }
  return ids;
}

export async function getClosedOrdersForAdjust(params?: {
  search?: string;
  /** 完了日のカレンダー月 "YYYYMM"（未指定なら全期間） */
  yearMonth?: string;
  page?: number;
  perPage?: number;
}) {
  await requireAdminSession();

  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = {
    deletedAt: null,
    status: "CONFIRMED",
    completionStatus: "CLOSED",
    factoryFloor: { deletedAt: null },
  };

  if (params?.yearMonth && /^\d{6}$/.test(params.yearMonth)) {
    const y = Number(params.yearMonth.slice(0, 4));
    const m = Number(params.yearMonth.slice(4, 6));
    where.completedDay = {
      gte: new Date(y, m - 1, 1, 0, 0, 0, 0),
      lte: new Date(y, m, 0, 23, 59, 59, 999),
    };
  }

  if (params?.search) {
    const q = params.search;
    // 受注者名は FactoryFloorOrder に会社リレーションが無いため、会社IDに解決してから絞る
    const workerIds = (
      await prisma.company.findMany({
        where: { name: { contains: q }, deletedAt: null },
        select: { id: true },
      })
    ).map((c) => c.id);
    where.OR = [
      { factoryFloor: { name: { contains: q } } },
      { factoryFloor: { parent: { name: { contains: q } } } },
      { factoryFloor: { company: { name: { contains: q } } } },
      ...(workerIds.length > 0 ? [{ workCompanyId: { in: workerIds } }] : []),
    ];
  }

  const [orders, total, invoicedIds] = await Promise.all([
    prisma.factoryFloorOrder.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { completedDay: "desc" },
      select: {
        id: true,
        completedDay: true,
        workCompanyId: true,
        factoryFloor: {
          select: {
            id: true,
            name: true,
            code: true,
            company: { select: { name: true, billingClosingDay: true } },
            parent: { select: { name: true, code: true } },
          },
        },
        documents: {
          where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
          select: { documentNumber: true, totalAmount: true },
        },
        completionReport: { select: { completionDate: true } },
      },
    }),
    prisma.factoryFloorOrder.count({ where }),
    getInvoicedOrderIdSet(),
  ]);

  const workerIds = [...new Set(orders.map((o) => o.workCompanyId))];
  const workers = await prisma.company.findMany({
    where: { id: { in: workerIds } },
    select: { id: true, name: true },
  });
  const workerNameById = new Map(workers.map((w) => [w.id, w.name]));

  const rows = orders.map((o) => {
    const sheet = o.documents[0];
    const closingDay = o.factoryFloor.company?.billingClosingDay ?? null;
    return {
      id: o.id,
      completedDay: o.completedDay ? o.completedDay.toISOString() : null,
      billingMonth: o.completedDay ? billingMonthOf(o.completedDay, closingDay) : null,
      closingDay,
      ordererName: o.factoryFloor.company?.name ?? "",
      workerName: workerNameById.get(o.workCompanyId) ?? "",
      siteName: o.factoryFloor.name ?? "",
      parentSiteName: o.factoryFloor.parent?.name ?? null,
      siteCode: o.factoryFloor.code ?? o.factoryFloor.parent?.code ?? "",
      documentNumber: sheet?.documentNumber ?? "",
      totalAmount: o.documents.reduce((s, d) => s + Number(d.totalAmount ?? 0), 0),
      invoiced: invoicedIds.has(o.id),
    };
  });

  return { rows, total, totalPages: Math.ceil(total / perPage), page };
}

/**
 * 発注書の完了日を変更する（YYYY-MM-DD）。
 * 保存形式はユーザーアプリの施工報告と同じ「サーバーローカル 00:00 の日付のみ」。
 */
export async function updateOrderCompletedDay(orderId: string, date: string) {
  const admin = await requireAdminSession();

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error("日付の形式が不正です");
  const newDay = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(newDay.getTime())) throw new Error("日付が不正です");

  const order = await prisma.factoryFloorOrder.findFirst({
    where: { id: orderId, deletedAt: null },
    select: { id: true, status: true, completionStatus: true, completedDay: true, factoryFloorId: true },
  });
  if (!order) throw new Error("発注が見つかりません");
  if (order.status !== "CONFIRMED" || order.completionStatus !== "CLOSED") {
    throw new Error("完了(CLOSED)していない発注書の完了日は変更できません");
  }

  const invoicedIds = await getInvoicedOrderIdSet();
  if (invoicedIds.has(orderId)) {
    throw new Error("この発注書は請求書に含まれているため変更できません。先に請求書を無効にしてください。");
  }

  await prisma.$transaction(async (tx) => {
    await tx.factoryFloorOrder.update({
      where: { id: orderId },
      data: { completedDay: newDay },
    });

    // 施工報告の「施工完了日」表示も揃える（報告が無い旧データはスキップ）
    await tx.completionReport.updateMany({
      where: { factoryFloorOrderId: orderId },
      data: { completionDate: newDay },
    });

    // 現場の完了日 = 完了済み発注書の最終完了日
    const closed = await tx.factoryFloorOrder.findMany({
      where: {
        factoryFloorId: order.factoryFloorId,
        deletedAt: null,
        status: "CONFIRMED",
        completionStatus: "CLOSED",
      },
      select: { completedDay: true },
    });
    const latest = closed
      .map((o) => o.completedDay)
      .filter((d): d is Date => !!d)
      .reduce<Date | null>((mx, d) => (!mx || d > mx ? d : mx), null);
    if (latest) {
      await tx.factoryFloor.update({
        where: { id: order.factoryFloorId },
        data: { finishDay: latest },
      });
    }
  });

  console.info(
    `[billing-adjust] admin=${admin.email} order=${orderId} completedDay ${order.completedDay?.toISOString() ?? "-"} -> ${newDay.toISOString()}`
  );

  return { success: true as const };
}
