"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { generateInvoice, generateInvoiceFromOrders } from "@/lib/services/document-generator";
import { getBillingPeriod, getBillingMonth } from "@/lib/helpers/billing-period";

/**
 * 請求書候補を取得
 * 対象月に締切(CLOSED)された発注があるが、まだ請求書が存在しない
 * (workerCompanyId, orderCompanyId) のペアを返す
 */
export async function getInvoiceCandidates(yearMonth: string) {
  const user = await requireSession();

  const year = parseInt(yearMonth.substring(0, 4));
  const month = parseInt(yearMonth.substring(4, 6));
  // 締め日は発注者ごとに異なるため、生窓を広め(前月1日〜当月末日)に取り、
  // 各発注を発注者の締め日で締め月に振り分けてから絞り込む。
  const rawStart = new Date(year, month - 2, 1, 0, 0, 0, 0);
  const rawEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // 対象期間に締切(CLOSED)された発注を取得（自社が受注者）
  const orders = await prisma.factoryFloorOrder.findMany({
    where: {
      deletedAt: null,
      status: "CONFIRMED",
      completionStatus: "CLOSED",
      workCompanyId: user.companyId,
      completedDay: { gte: rawStart, lte: rawEnd },
      factoryFloor: { deletedAt: null },
    },
    select: {
      id: true,
      completedDay: true,
      workCompanyId: true,
      factoryFloor: {
        select: { id: true, companyId: true, company: { select: { id: true, name: true } } },
      },
      documents: {
        where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
        select: { id: true, subtotal: true, taxAmount: true, totalAmount: true },
      },
    },
  });

  if (orders.length === 0) return [];

  // 各発注者の締め日を取得し、締め月の判定に使う
  const candidateOrdererIds = [...new Set(orders.map((o) => o.factoryFloor.companyId))];
  const candidateOrderers = await prisma.company.findMany({
    where: { id: { in: candidateOrdererIds } },
    select: { id: true, billingClosingDay: true },
  });
  const candidateClosingByOrderer = new Map(
    candidateOrderers.map((o) => [o.id, o.billingClosingDay])
  );

  // 受注者(自社)名を取得（FactoryFloorOrder には workCompany リレーションが無いため別途取得）
  const candidateWorkerIds = [...new Set(orders.map((o) => o.workCompanyId))];
  const candidateWorkers = await prisma.company.findMany({
    where: { id: { in: candidateWorkerIds } },
    select: { id: true, name: true },
  });
  const candidateWorkerNameById = new Map(candidateWorkers.map((c) => [c.id, c.name]));

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

  for (const order of orders) {
    // 注文書(ORDER_SHEET)が無い発注は請求対象外
    if (order.documents.length === 0) continue;

    const orderCompanyId = order.factoryFloor.companyId;
    // 締め日に基づく締め月が対象月と一致しない発注は除外
    if (
      !order.completedDay ||
      getBillingMonth(order.completedDay, candidateClosingByOrderer.get(orderCompanyId) ?? null) !== yearMonth
    ) {
      continue;
    }
    const key = `${order.workCompanyId}::${orderCompanyId}`;
    if (invoicedPairs.has(key)) continue;

    // 発注の注文書(通常1件)の totalAmount を合算
    const orderTotal = order.documents.reduce((sum, d) => sum + Number(d.totalAmount ?? 0), 0);

    const existing = pairMap.get(key);
    if (existing) {
      existing.deliveryNoteCount += 1;
      existing.totalAmount += orderTotal;
    } else {
      pairMap.set(key, {
        workerCompanyId: order.workCompanyId,
        orderCompanyId,
        workerCompanyName: candidateWorkerNameById.get(order.workCompanyId) ?? "",
        orderCompanyName: order.factoryFloor.company?.name ?? "",
        deliveryNoteCount: 1,
        totalAmount: orderTotal,
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

  // 対象月の締切(CLOSED)発注を受注者ごとに集計
  const year = parseInt(yearMonth.substring(0, 4));
  const month = parseInt(yearMonth.substring(4, 6));
  // 発注者の締め日に基づく請求期間で集計（締め日 null は月末締め）
  const { start: startOfMonth, end: endOfMonth } = getBillingPeriod(
    yearMonth,
    company.billingClosingDay
  );

  const orders = await prisma.factoryFloorOrder.findMany({
    where: {
      deletedAt: null,
      status: "CONFIRMED",
      completionStatus: "CLOSED",
      factoryFloor: { companyId, deletedAt: null },
      completedDay: { gte: startOfMonth, lte: endOfMonth },
    },
    select: {
      workCompanyId: true,
    },
  });

  if (orders.length === 0) return [];

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
  const workerIds = [...new Set(orders.map((o) => o.workCompanyId))].filter(
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
      // 請求対象の工事がない場合はスキップ
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

  // 関連する発注の FactoryFloor を DEAL_COMPLETED に更新。
  // 新方式: metadata.orderIds（発注ID）/ 旧方式: metadata.deliveryNoteIds（納品書ID）
  const metadata = doc.metadata as Record<string, unknown> | null;
  const metaOrderIds = (metadata?.orderIds as string[]) ?? [];
  const deliveryNoteIds = (metadata?.deliveryNoteIds as string[]) ?? [];

  let floorIds: string[] = [];

  if (metaOrderIds.length > 0) {
    // 新方式: 発注IDから直接 FactoryFloor を解決
    const orders = await prisma.factoryFloorOrder.findMany({
      where: { id: { in: metaOrderIds } },
      select: { factoryFloorId: true },
    });
    floorIds = orders.map((o) => o.factoryFloorId);
  } else if (deliveryNoteIds.length > 0) {
    // 旧方式: 納品書 → FactoryFloorOrder → FactoryFloor
    const deliveryNotes = await prisma.document.findMany({
      where: { id: { in: deliveryNoteIds } },
      select: { factoryFloorOrderId: true },
    });

    const orderIds = deliveryNotes.map((n) => n.factoryFloorOrderId);
    const orders = await prisma.factoryFloorOrder.findMany({
      where: { id: { in: orderIds } },
      select: { factoryFloorId: true },
    });
    floorIds = orders.map((o) => o.factoryFloorId);
  }

  if (floorIds.length > 0) {
    await prisma.factoryFloor.updateMany({
      where: {
        id: { in: floorIds },
        status: { in: ["DELIVERY_APPROVED", "INVOICED"] },
      },
      data: { status: "DEAL_COMPLETED" },
    });
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

/**
 * 未請求の締切(CLOSED)発注一覧を取得（月別フィルター）
 */
export async function getAvailableDeliveryNotes(yearMonth: string) {
  const user = await requireSession();

  const year = parseInt(yearMonth.substring(0, 4));
  const month = parseInt(yearMonth.substring(4, 6));
  // 締め日は発注者ごとに異なるため、生窓を広め(前月1日〜当月末日)に取り、
  // 各発注を発注者の締め日で締め月に振り分けてから絞り込む。
  const rawStart = new Date(year, month - 2, 1, 0, 0, 0, 0);
  const rawEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // 対象期間に締切(CLOSED)された発注を取得（自社が発注者または受注者）
  const orders = await prisma.factoryFloorOrder.findMany({
    where: {
      deletedAt: null,
      status: "CONFIRMED",
      completionStatus: "CLOSED",
      completedDay: { gte: rawStart, lte: rawEnd },
      factoryFloor: { deletedAt: null },
      OR: [
        { factoryFloor: { companyId: user.companyId } },
        { workCompanyId: user.companyId },
      ],
    },
    select: {
      id: true,
      completedDay: true,
      workCompanyId: true,
      factoryFloor: { select: { name: true, companyId: true } },
      documents: {
        where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
        select: { id: true, documentNumber: true, totalAmount: true, metadata: true },
      },
    },
    orderBy: { completedDay: "desc" },
  });

  if (orders.length === 0) return [];

  // 各発注者の締め日を取得（発注の締め月判定に使用）
  const availOrdererIds = [...new Set(orders.map((o) => o.factoryFloor.companyId))];
  const availOrderers = await prisma.company.findMany({
    where: { id: { in: availOrdererIds } },
    select: { id: true, billingClosingDay: true },
  });
  const availClosingByOrderer = new Map(
    availOrderers.map((o) => [o.id, o.billingClosingDay])
  );

  // 受注者名を取得（FactoryFloorOrder には workCompany リレーションが無いため別途取得）
  const availWorkerIds = [...new Set(orders.map((o) => o.workCompanyId))];
  const availWorkers = await prisma.company.findMany({
    where: { id: { in: availWorkerIds } },
    select: { id: true, name: true },
  });
  const availWorkerNameById = new Map(availWorkers.map((c) => [c.id, c.name]));

  // 既存の請求書に含まれている発注IDを収集（新方式 orderIds / 旧方式 deliveryNoteIds）
  const existingInvoices = await prisma.document.findMany({
    where: {
      type: "INVOICE",
      OR: [
        { orderCompanyId: user.companyId },
        { workerCompanyId: user.companyId },
      ],
      deletedAt: null,
      status: { not: "VOID" },
    },
    select: { metadata: true },
  });

  const invoicedOrderIds = new Set<string>();
  for (const inv of existingInvoices) {
    const meta = inv.metadata as Record<string, unknown> | null;
    const ids = (meta?.orderIds as string[]) ?? [];
    for (const id of ids) {
      invoicedOrderIds.add(id);
    }
  }

  // 未請求かつ締め月が対象月で、注文書(ORDER_SHEET)がある発注のみ返却
  return orders
    .filter(
      (o) =>
        o.documents.length > 0 &&
        !invoicedOrderIds.has(o.id) &&
        !!o.completedDay &&
        getBillingMonth(o.completedDay, availClosingByOrderer.get(o.factoryFloor.companyId) ?? null) === yearMonth
    )
    .map((o) => {
      const sheet = o.documents[0];
      return {
        id: o.id,
        documentNumber: sheet?.documentNumber ?? null,
        issuedAt: o.completedDay?.toISOString() ?? null,
        totalAmount: o.documents.reduce((sum, d) => sum + Number(d.totalAmount ?? 0), 0),
        siteName:
          o.factoryFloor.name ??
          ((sheet?.metadata as Record<string, unknown> | null)?.siteName as string) ??
          "",
        workerCompanyId: o.workCompanyId,
        workerCompanyName: availWorkerNameById.get(o.workCompanyId) ?? "",
      };
    });
}

/**
 * 手動で請求書を作成
 * 引数 deliveryNoteIds は発注ID(FactoryFloorOrder.id)の配列として扱う（UIの互換のため名前は据え置き）。
 */
export async function createManualInvoice(
  deliveryNoteIds: string[],
  billingDate: string,
) {
  const user = await requireSession();

  if (deliveryNoteIds.length === 0) {
    throw new Error("工事を選択してください");
  }

  // 全発注が締切(CLOSED)済みで、自社（発注者 or 受注者）のものであることを検証
  const orders = await prisma.factoryFloorOrder.findMany({
    where: {
      id: { in: deliveryNoteIds },
      deletedAt: null,
    },
    select: {
      id: true,
      completionStatus: true,
      workCompanyId: true,
      factoryFloor: { select: { companyId: true } },
    },
  });

  if (orders.length !== deliveryNoteIds.length) {
    throw new Error("一部の工事が見つかりません");
  }

  for (const order of orders) {
    if (order.completionStatus !== "CLOSED") {
      throw new Error("締切されていない工事が含まれています");
    }
    if (order.factoryFloor.companyId !== user.companyId && order.workCompanyId !== user.companyId) {
      throw new Error("権限のない工事が含まれています");
    }
  }

  // 同一受注者であることを検証
  const workerIds = new Set(orders.map((o) => o.workCompanyId));
  if (workerIds.size > 1) {
    throw new Error("異なる受注者の工事が混在しています。同一受注者の工事を選択してください");
  }

  const date = new Date(billingDate + "T00:00:00");
  const docId = await generateInvoiceFromOrders(deliveryNoteIds, date);

  // 発注者の支払期日タイプから支払期日を自動設定（自動生成の請求書と挙動を揃える）。
  // generateInvoiceFromOrders 成功時点で全発注は同一発注者なので orders[0] を使用。
  const orderCompany = await prisma.company.findUnique({
    where: { id: orders[0].factoryFloor.companyId },
    select: { paymentDueType: true },
  });
  const dueDate = calculateDueDate(
    orderCompany?.paymentDueType ?? null,
    date.getFullYear(),
    date.getMonth() + 1
  );
  if (dueDate) {
    await prisma.document.update({ where: { id: docId }, data: { dueDate } });
  }

  return { id: docId };
}
