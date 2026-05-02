"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { generateInvoice } from "@/lib/services/document-generator";

/**
 * 請求書候補を取得
 * 対象月に ISSUED/CONFIRMED の納品書があるが、まだ請求書が存在しない
 * (workerCompanyId, orderCompanyId) のペアを返す
 */
export async function getInvoiceCandidates(yearMonth: string) {
  const user = await requireSession();

  const year = parseInt(yearMonth.substring(0, 4));
  const month = parseInt(yearMonth.substring(4, 6));
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  // 対象月の ISSUED/CONFIRMED 納品書を取得（自社が受注者）
  const deliveryNotes = await prisma.document.findMany({
    where: {
      type: "DELIVERY_NOTE",
      status: { in: ["ISSUED", "CONFIRMED"] },
      workerCompanyId: user.companyId,
      issuedAt: { gte: startOfMonth, lte: endOfMonth },
      deletedAt: null,
    },
    select: {
      id: true,
      workerCompanyId: true,
      orderCompanyId: true,
      totalAmount: true,
      orderCompany: { select: { id: true, name: true } },
      workerCompany: { select: { id: true, name: true } },
    },
  });

  if (deliveryNotes.length === 0) return [];

  // 既存の請求書（同月）を取得
  const existingInvoices = await prisma.document.findMany({
    where: {
      type: "INVOICE",
      workerCompanyId: user.companyId,
      yearMonth,
      deletedAt: null,
    },
    select: { workerCompanyId: true, orderCompanyId: true },
  });

  const invoicedPairs = new Set(
    existingInvoices.map((inv) => `${inv.workerCompanyId}::${inv.orderCompanyId}`)
  );

  // (workerCompanyId, orderCompanyId) ペアごとに集計
  const pairMap = new Map<
    string,
    {
      workerCompanyId: string;
      orderCompanyId: string;
      workerCompanyName: string;
      orderCompanyName: string;
      deliveryNoteCount: number;
      totalAmount: number;
    }
  >();

  for (const note of deliveryNotes) {
    const key = `${note.workerCompanyId}::${note.orderCompanyId}`;
    if (invoicedPairs.has(key)) continue;

    const existing = pairMap.get(key);
    if (existing) {
      existing.deliveryNoteCount += 1;
      existing.totalAmount += Number(note.totalAmount ?? 0);
    } else {
      pairMap.set(key, {
        workerCompanyId: note.workerCompanyId,
        orderCompanyId: note.orderCompanyId,
        workerCompanyName: note.workerCompany.name ?? "",
        orderCompanyName: note.orderCompany.name ?? "",
        deliveryNoteCount: 1,
        totalAmount: Number(note.totalAmount ?? 0),
      });
    }
  }

  return Array.from(pairMap.values());
}

/**
 * 月次請求書を発行
 * document-generator の generateInvoice() を呼び出してドキュメントIDを返す
 */
export async function generateMonthlyInvoice(
  orderCompanyId: string,
  yearMonth: string
): Promise<string> {
  const user = await requireSession();
  return generateInvoice(user.companyId, orderCompanyId, yearMonth);
}

/**
 * 発注者の締め日に基づいてドラフト請求書を受注者ごとに自動生成
 */
export async function generateDraftInvoices(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      billingClosingDay: true,
      billingGraceDays: true,
      paymentDueType: true,
    },
  });
  if (!company) return [];

  // 対象月の yearMonth を計算
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 対象月の納品書（DELIVERY_APPROVED状態）を受注者ごとに集計
  const year = parseInt(yearMonth.substring(0, 4));
  const month = parseInt(yearMonth.substring(4, 6));
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const deliveryNotes = await prisma.document.findMany({
    where: {
      type: "DELIVERY_NOTE",
      status: { in: ["ISSUED", "CONFIRMED"] },
      orderCompanyId: companyId,
      issuedAt: { gte: startOfMonth, lte: endOfMonth },
      deletedAt: null,
    },
    select: {
      workerCompanyId: true,
      orderCompanyId: true,
    },
  });

  if (deliveryNotes.length === 0) return [];

  // 既存のドラフト請求書を確認
  const existingInvoices = await prisma.document.findMany({
    where: {
      type: "INVOICE",
      orderCompanyId: companyId,
      yearMonth,
      deletedAt: null,
    },
    select: { workerCompanyId: true },
  });

  const invoicedWorkers = new Set(existingInvoices.map((i) => i.workerCompanyId));

  // 受注者ごとにユニークなIDを集める
  const workerIds = [...new Set(deliveryNotes.map((n) => n.workerCompanyId))].filter(
    (id) => !invoicedWorkers.has(id)
  );

  // 支払期日を計算
  const dueDate = calculateDueDate(company.paymentDueType, year, month);

  const createdIds: string[] = [];
  for (const workerCompanyId of workerIds) {
    try {
      const docId = await generateInvoice(workerCompanyId, companyId, yearMonth);
      // ドラフト状態に戻す + 支払期日を設定
      await prisma.document.update({
        where: { id: docId },
        data: {
          status: "DRAFT",
          dueDate,
        },
      });
      createdIds.push(docId);
    } catch {
      // 納品書がない場合はスキップ
    }
  }

  return createdIds;
}

/**
 * 支払期日を計算
 */
function calculateDueDate(
  type: string | null | undefined,
  billingYear: number,
  billingMonth: number
): Date | null {
  if (!type) return null;

  switch (type) {
    case "NEXT_MONTH_END": {
      // 翌月末
      const d = new Date(billingYear, billingMonth + 1, 0);
      return d;
    }
    case "NEXT_MONTH_25": {
      return new Date(billingYear, billingMonth, 25);
    }
    case "NEXT_MONTH_20": {
      return new Date(billingYear, billingMonth, 20);
    }
    case "NEXT_MONTH_15": {
      return new Date(billingYear, billingMonth, 15);
    }
    case "TWO_MONTHS_END": {
      // 翌々月末
      const d = new Date(billingYear, billingMonth + 2, 0);
      return d;
    }
    default:
      return null;
  }
}

/**
 * 請求書を確定する（発注者）
 */
export async function confirmInvoice(documentId: string) {
  const user = await requireSession();

  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      type: "INVOICE",
      orderCompanyId: user.companyId,
      status: "DRAFT",
      deletedAt: null,
    },
    select: {
      id: true,
      workerCompanyId: true,
      yearMonth: true,
      totalAmount: true,
      workerCompany: { select: { name: true } },
    },
  });

  if (!doc) throw new Error("請求書が見つかりません");

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: "ISSUED",
      confirmedAt: new Date(),
    },
  });

  // 受注者に通知
  const contractorUsers = await prisma.user.findMany({
    where: { companyId: doc.workerCompanyId, isActive: true, deletedAt: null },
    select: { id: true },
  });

  if (contractorUsers.length > 0) {
    await prisma.notification.createMany({
      data: contractorUsers.map((u) => ({
        userId: u.id,
        title: "請求書確定",
        content: `${doc.yearMonth?.substring(0, 4)}年${doc.yearMonth?.substring(4)}月分の請求書が確定されました`,
        type: 41,
        targetId: documentId,
      })),
    });
  }

  return { success: true };
}

/**
 * 請求書を再集計する（発注者）- 遅れた納品書を含めて再生成
 */
export async function recalculateInvoice(documentId: string) {
  const user = await requireSession();

  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      type: "INVOICE",
      orderCompanyId: user.companyId,
      status: "DRAFT",
      deletedAt: null,
    },
    select: {
      id: true,
      workerCompanyId: true,
      orderCompanyId: true,
      yearMonth: true,
      dueDate: true,
    },
  });

  if (!doc) throw new Error("請求書が見つかりません");
  if (!doc.yearMonth) throw new Error("対象月が不明です");

  // 古い請求書を無効化
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "VOID", deletedAt: new Date() },
  });

  // 再生成
  const newDocId = await generateInvoice(doc.workerCompanyId, doc.orderCompanyId, doc.yearMonth);

  // ドラフト状態 + 支払期日を引き継ぎ
  await prisma.document.update({
    where: { id: newDocId },
    data: {
      status: "DRAFT",
      dueDate: doc.dueDate,
    },
  });

  return newDocId;
}

/**
 * 猶予期限超過の請求書を自動確定（Cron用）
 */
export async function autoConfirmOverdueInvoices() {
  const now = new Date();

  // 全社のドラフト請求書を取得
  const draftInvoices = await prisma.document.findMany({
    where: {
      type: "INVOICE",
      status: "DRAFT",
      deletedAt: null,
    },
    include: {
      orderCompany: {
        select: {
          billingClosingDay: true,
          billingGraceDays: true,
        },
      },
    },
  });

  let confirmedCount = 0;

  for (const invoice of draftInvoices) {
    if (!invoice.yearMonth) continue;

    const graceDays = invoice.orderCompany.billingGraceDays ?? 5;
    const closingDay = invoice.orderCompany.billingClosingDay;
    const year = parseInt(invoice.yearMonth.substring(0, 4));
    const month = parseInt(invoice.yearMonth.substring(4, 6));

    // 締め日を計算
    let closingDate: Date;
    if (closingDay) {
      closingDate = new Date(year, month - 1, closingDay);
    } else {
      // 月末
      closingDate = new Date(year, month, 0);
    }

    // 猶予期限 = 締め日 + 猶予日数
    const graceDeadline = new Date(closingDate);
    graceDeadline.setDate(graceDeadline.getDate() + graceDays);

    if (now > graceDeadline) {
      await prisma.document.update({
        where: { id: invoice.id },
        data: {
          status: "ISSUED",
          autoConfirmedAt: now,
          confirmedAt: now,
        },
      });

      // 受注者に通知
      const contractorUsers = await prisma.user.findMany({
        where: { companyId: invoice.workerCompanyId, isActive: true, deletedAt: null },
        select: { id: true },
      });

      if (contractorUsers.length > 0) {
        await prisma.notification.createMany({
          data: contractorUsers.map((u) => ({
            userId: u.id,
            title: "請求書自動確定",
            content: `${invoice.yearMonth?.substring(0, 4)}年${invoice.yearMonth?.substring(4)}月分の請求書が自動確定されました`,
            type: 41,
            targetId: invoice.id,
          })),
        });
      }

      confirmedCount++;
    }
  }

  return { confirmedCount };
}

/**
 * 請求書一覧を取得（発注者・受注者共通）
 */
export async function getBillingList(yearMonth: string) {
  const user = await requireSession();

  const invoices = await prisma.document.findMany({
    where: {
      type: "INVOICE",
      yearMonth,
      deletedAt: null,
      OR: [
        { orderCompanyId: user.companyId },
        { workerCompanyId: user.companyId },
      ],
    },
    select: {
      id: true,
      documentNumber: true,
      status: true,
      subtotal: true,
      taxAmount: true,
      totalAmount: true,
      yearMonth: true,
      dueDate: true,
      issuedAt: true,
      confirmedAt: true,
      autoConfirmedAt: true,
      pdfUrl: true,
      orderCompanyId: true,
      workerCompanyId: true,
      orderCompany: { select: { id: true, name: true } },
      workerCompany: { select: { id: true, name: true } },
      metadata: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return invoices.map((inv) => ({
    ...inv,
    subtotal: inv.subtotal ? Number(inv.subtotal) : 0,
    taxAmount: inv.taxAmount ? Number(inv.taxAmount) : 0,
    totalAmount: inv.totalAmount ? Number(inv.totalAmount) : 0,
    isOrderer: inv.orderCompanyId === user.companyId,
    issuedAt: inv.issuedAt?.toISOString() ?? null,
    confirmedAt: inv.confirmedAt?.toISOString() ?? null,
    autoConfirmedAt: inv.autoConfirmedAt?.toISOString() ?? null,
    dueDate: inv.dueDate?.toISOString() ?? null,
  }));
}

/**
 * 支払い完了を記録する（発注者）
 */
export async function markInvoicePaid(documentId: string) {
  const user = await requireSession();

  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      type: "INVOICE",
      orderCompanyId: user.companyId,
      status: { in: ["ISSUED", "CONFIRMED"] },
      deletedAt: null,
    },
    select: {
      id: true,
      workerCompanyId: true,
      yearMonth: true,
      metadata: true,
    },
  });

  if (!doc) throw new Error("請求書が見つかりません");

  // 請求書を CONFIRMED (支払済み) に
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "CONFIRMED" },
  });

  // 関連する納品書のFactoryFloorOrderからFactoryFloorをDEAL_COMPLETEDに更新
  const metadata = doc.metadata as Record<string, unknown> | null;
  const deliveryNoteIds = (metadata?.deliveryNoteIds as string[]) ?? [];

  if (deliveryNoteIds.length > 0) {
    const deliveryNotes = await prisma.document.findMany({
      where: { id: { in: deliveryNoteIds } },
      select: { factoryFloorOrderId: true },
    });

    const orderIds = deliveryNotes.map((n) => n.factoryFloorOrderId);
    const orders = await prisma.factoryFloorOrder.findMany({
      where: { id: { in: orderIds } },
      select: { factoryFloorId: true },
    });

    const floorIds = orders.map((o) => o.factoryFloorId);
    if (floorIds.length > 0) {
      await prisma.factoryFloor.updateMany({
        where: {
          id: { in: floorIds },
          status: { in: ["DELIVERY_APPROVED", "INVOICED"] },
        },
        data: { status: "DEAL_COMPLETED" },
      });
    }
  }

  // 受注者に支払い完了通知
  const contractorUsers = await prisma.user.findMany({
    where: { companyId: doc.workerCompanyId, isActive: true, deletedAt: null },
    select: { id: true },
  });

  if (contractorUsers.length > 0) {
    await prisma.notification.createMany({
      data: contractorUsers.map((u) => ({
        userId: u.id,
        title: "支払い完了",
        content: `${doc.yearMonth?.substring(0, 4)}年${doc.yearMonth?.substring(4)}月分の支払いが完了しました`,
        type: 43,
        targetId: documentId,
      })),
    });
  }

  return { success: true };
}
