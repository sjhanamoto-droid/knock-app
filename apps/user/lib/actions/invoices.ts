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
