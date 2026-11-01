"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  generateInvoice,
  generateInvoiceFromOrders,
  getBillableRowsForInvoice,
} from "@/lib/services/document-generator";
import { getBillingMonth } from "@/lib/helpers/billing-period";
import { getInvoicedOrderIds, getInvoicedProgressIds } from "@/lib/helpers/invoiced-orders";
import { PROGRESS_KEY_PREFIX, progressLineName, progressTax } from "@/lib/helpers/progress-billing";

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
      // 自社が受注者・発注者のどちらでも候補に含める（発注者側からの作成を許可）
      OR: [
        { workCompanyId: user.companyId },
        { factoryFloor: { companyId: user.companyId } },
      ],
      completedDay: { gte: rawStart, lte: rawEnd },
      factoryFloor: { deletedAt: null },
      // 出来高を確定済みの発注書は出来高側(申請月)で請求する
      progressBillings: { none: { status: "CONFIRMED" } },
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

  // 確定済みで未請求の出来高（請求月=申請月）
  const progressItems = await prisma.progressBilling.findMany({
    where: {
      status: "CONFIRMED",
      billingMonth: yearMonth,
      factoryFloorOrder: {
        deletedAt: null,
        OR: [
          { workCompanyId: user.companyId },
          { factoryFloor: { companyId: user.companyId } },
        ],
        factoryFloor: { deletedAt: null },
      },
    },
    select: {
      id: true,
      amount: true,
      factoryFloorOrder: {
        select: {
          workCompanyId: true,
          factoryFloor: { select: { companyId: true, company: { select: { name: true } } } },
        },
      },
    },
  });

  if (orders.length === 0 && progressItems.length === 0) return [];

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
  const candidateWorkerIds = [
    ...new Set([
      ...orders.map((o) => o.workCompanyId),
      ...progressItems.map((p) => p.factoryFloorOrder.workCompanyId),
    ]),
  ];
  const candidateWorkers = await prisma.company.findMany({
    where: { id: { in: candidateWorkerIds } },
    select: { id: true, name: true },
  });
  const candidateWorkerNameById = new Map(candidateWorkers.map((c) => [c.id, c.name]));

  // 既に非VOIDの請求書に含まれている「発注」を除外（発注単位）。
  // ペア×月単位でロックすると、未請求の締め済み発注が残っていても取引先ごと
  // 候補から消えてしまうため、生成/納品書選択と同じ「発注単位」に揃える。
  const invoicedOrderIds = await getInvoicedOrderIds({ companyIdEitherSide: user.companyId });

  // (workerCompanyId, orderCompanyId) ペアごとに集計
  const pairMap = new Map<
    string,
    {
      workerCompanyId: string;
      orderCompanyId: string;
      workerCompanyName: string;
      orderCompanyName: string;
      // 自社のロール: "worker"=受注者(相手=発注者に請求) / "orderer"=発注者(受注者に代理発行)
      role: "worker" | "orderer";
      orderCount: number;
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
    // 発注単位で二重請求を除外（既に非VOIDの請求書に含まれている発注はスキップ）
    if (invoicedOrderIds.has(order.id)) continue;

    const key = `${order.workCompanyId}::${orderCompanyId}`;

    // 発注の注文書(通常1件)の totalAmount を合算
    const orderTotal = order.documents.reduce((sum, d) => sum + Number(d.totalAmount ?? 0), 0);

    const existing = pairMap.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalAmount += orderTotal;
    } else {
      pairMap.set(key, {
        workerCompanyId: order.workCompanyId,
        orderCompanyId,
        workerCompanyName: candidateWorkerNameById.get(order.workCompanyId) ?? "",
        orderCompanyName: order.factoryFloor.company?.name ?? "",
        role: order.workCompanyId === user.companyId ? "worker" : "orderer",
        orderCount: 1,
        totalAmount: orderTotal,
      });
    }
  }

  // 出来高: 確定金額(税抜)＋消費税を「1件」として合算
  const invoicedProgressIds = await getInvoicedProgressIds({ companyIdEitherSide: user.companyId });
  for (const p of progressItems) {
    if (invoicedProgressIds.has(p.id)) continue;
    const workCompanyId = p.factoryFloorOrder.workCompanyId;
    const orderCompanyId = p.factoryFloorOrder.factoryFloor.companyId;
    const key = `${workCompanyId}::${orderCompanyId}`;
    const subtotal = Number(p.amount);
    const total = subtotal + progressTax(subtotal);
    const existing = pairMap.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalAmount += total;
    } else {
      pairMap.set(key, {
        workerCompanyId: workCompanyId,
        orderCompanyId,
        workerCompanyName: candidateWorkerNameById.get(workCompanyId) ?? "",
        orderCompanyName: p.factoryFloorOrder.factoryFloor.company?.name ?? "",
        role: workCompanyId === user.companyId ? "worker" : "orderer",
        orderCount: 1,
        totalAmount: total,
      });
    }
  }

  return Array.from(pairMap.values());
}

/**
 * 発注者が受注会社ごとに請求書を作成する前のプレビュー。
 * その月に合算される注文書（発注）の一覧と合計を返す。generateInvoice と同じ抽出条件。
 */
export async function getInvoicePreviewForWorker(workerCompanyId: string, yearMonth: string) {
  const user = await requireSession();
  const [worker, billableRows] = await Promise.all([
    prisma.company.findUnique({ where: { id: workerCompanyId }, select: { name: true } }),
    // user.companyId = 発注者(orderCompany)。発注書(注文書金額)＋確定済み出来高(申請月)
    getBillableRowsForInvoice(workerCompanyId, user.companyId, yearMonth),
  ]);

  const rows = billableRows.map((r) => ({
    // orderId = 明細キー（発注ID or "pb:<出来高ID>"）
    orderId: r.key,
    type: r.type,
    isFinal: r.progressKind === "FINAL",
    documentNumber: r.documentNumber,
    siteName: r.siteName,
    parentSiteName: r.parentSiteName,
    siteCode: r.siteCode,
    completedDay: r.date ? r.date.toISOString() : null,
    subtotal: r.subtotal,
    taxAmount: r.taxAmount,
    totalAmount: r.totalAmount,
  }));

  return {
    workerCompanyName: worker?.name ?? "",
    orders: rows,
    subtotal: rows.reduce((s, r) => s + r.subtotal, 0),
    taxAmount: rows.reduce((s, r) => s + r.taxAmount, 0),
    totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
  };
}

/**
 * 発注者が「受注会社ごと」に月次請求書を代理発行する。
 * その月の締切(CLOSED)発注をすべて自動合算し、DRAFT で作成する（個別選択は不要）。
 * 完了報告の承認が未了の発注は generateInvoice 側で自動的に除外される。
 */
export async function generateInvoiceForWorker(
  workerCompanyId: string,
  yearMonth: string,
): Promise<{ id: string }> {
  const user = await requireSession();
  // user.companyId = 発注者(orderCompany)。受注会社(worker)宛の請求書を代理発行する。
  const docId = await generateInvoice(workerCompanyId, user.companyId, yearMonth);

  // 発注者の支払期日タイプから支払期日を自動設定（cron/従来の手動作成と挙動を揃える）。
  const orderCompany = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { paymentDueType: true },
  });
  const year = parseInt(yearMonth.substring(0, 4), 10);
  const month = parseInt(yearMonth.substring(4, 6), 10);
  const dueDate = calculateDueDate(orderCompany?.paymentDueType ?? null, year, month);

  // DRAFT にして確認(confirmInvoice)・再集計(recalculateInvoice)を可能にする。
  await prisma.document.update({
    where: { id: docId },
    data: { status: "DRAFT", ...(dueDate ? { dueDate } : {}) },
  });

  return { id: docId };
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

  // 先に新しい請求書を生成する。請求対象が無い等で generateInvoice が失敗した場合でも
  // 既存のドラフトを失わないよう、「生成成功後に」旧請求書を無効化する。
  // 生成時点では旧請求書(documentId)がまだ非VOIDのため、自分自身の発注を二重請求ガードで
  // 誤って除外しないよう excludeInvoiceIds に渡す（他の請求書の発注は従来どおり除外される）。
  const newDocId = await generateInvoice(doc.workerCompanyId, doc.orderCompanyId, doc.yearMonth, [
    documentId,
  ]);

  // ドラフト状態 + 支払期日の引き継ぎと旧請求書の無効化を原子的に実行
  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: newDocId },
      data: {
        status: "DRAFT",
        dueDate: doc.dueDate,
      },
    });

    await tx.document.update({
      where: { id: documentId },
      data: { status: "VOID", deletedAt: new Date() },
    });
  });

  return newDocId;
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

  // メタデータはJS操作のみ（DB不要）なのでトランザクション外で取得
  // 新方式: metadata.orderIds（発注ID）/ 旧方式: metadata.deliveryNoteIds（納品書ID）
  const metadata = doc.metadata as Record<string, unknown> | null;
  const metaOrderIds = (metadata?.orderIds as string[]) ?? [];
  const metaProgressIds = (metadata?.progressBillingIds as string[]) ?? [];
  const deliveryNoteIds = (metadata?.deliveryNoteIds as string[]) ?? [];

  await prisma.$transaction(async (tx) => {
    // 請求書を CONFIRMED (支払済み) に
    await tx.document.update({
      where: { id: documentId },
      data: { status: "CONFIRMED" },
    });

    // 関連する発注の FactoryFloor を DEAL_COMPLETED に更新
    let floorIds: string[] = [];

    if (metaOrderIds.length > 0 || metaProgressIds.length > 0) {
      // 新方式: 発注ID（出来高は出来高の発注ID）から直接 FactoryFloor を解決
      const progressOrderIds = metaProgressIds.length
        ? (
            await tx.progressBilling.findMany({
              where: { id: { in: metaProgressIds } },
              select: { factoryFloorOrderId: true },
            })
          ).map((p) => p.factoryFloorOrderId)
        : [];
      const orders = await tx.factoryFloorOrder.findMany({
        where: { id: { in: [...metaOrderIds, ...progressOrderIds] } },
        select: { factoryFloorId: true },
      });
      floorIds = orders.map((o) => o.factoryFloorId);
    } else if (deliveryNoteIds.length > 0) {
      // 旧方式: 納品書 → FactoryFloorOrder → FactoryFloor
      const deliveryNotes = await tx.document.findMany({
        where: { id: { in: deliveryNoteIds } },
        select: { factoryFloorOrderId: true },
      });

      const orderIds = deliveryNotes.map((n) => n.factoryFloorOrderId);
      const orders = await tx.factoryFloorOrder.findMany({
        where: { id: { in: orderIds } },
        select: { factoryFloorId: true },
      });
      floorIds = orders.map((o) => o.factoryFloorId);
    }

    if (floorIds.length > 0) {
      // 発注書は1件ずつ完了・請求されるため、1枚の請求書の支払いで現場全体が終わるとは限らない。
      // 現場の全発注(回答待ち含む)が完了(CLOSED)し、かつ全て支払済み請求書に含まれている現場だけを
      // 取引終端(DEAL_COMPLETED)にする。未請求/未払いの発注が残る現場は工事完了のまま
      // （追加工事の依頼で施工中に戻せる状態を保つ）。旧フローの DELIVERY_APPROVED/INVOICED も後方互換で許容。
      const paidInvoices = await tx.document.findMany({
        where: {
          type: "INVOICE",
          status: "CONFIRMED",
          orderCompanyId: user.companyId,
          deletedAt: null,
        },
        select: { metadata: true },
      });
      const paidOrderIds = new Set<string>();
      const paidProgressIds = new Set<string>();
      for (const inv of paidInvoices) {
        const meta = inv.metadata as Record<string, unknown> | null;
        for (const id of (meta?.orderIds as string[]) ?? []) paidOrderIds.add(id);
        for (const id of (meta?.progressBillingIds as string[]) ?? []) paidProgressIds.add(id);
      }

      const uniqueFloorIds = [...new Set(floorIds)];
      const floorOrders = await tx.factoryFloorOrder.findMany({
        where: {
          factoryFloorId: { in: uniqueFloorIds },
          deletedAt: null,
          status: { in: ["PENDING", "APPROVED", "CONFIRMED"] },
        },
        select: {
          id: true,
          factoryFloorId: true,
          status: true,
          completionStatus: true,
          progressBillings: { where: { status: "CONFIRMED" }, select: { id: true } },
        },
      });
      // 出来高で完了した発注書は、確定済みの出来高がすべて支払済みなら支払済みとみなす
      const isPaid = (o: (typeof floorOrders)[number]) =>
        o.progressBillings.length > 0
          ? o.progressBillings.every((p) => paidProgressIds.has(p.id))
          : paidOrderIds.has(o.id);
      const settledFloorIds = uniqueFloorIds.filter((fid) => {
        const orders = floorOrders.filter((o) => o.factoryFloorId === fid);
        return (
          orders.length > 0 &&
          orders.every(
            (o) => o.status === "CONFIRMED" && o.completionStatus === "CLOSED" && isPaid(o)
          )
        );
      });

      if (settledFloorIds.length > 0) {
        await tx.factoryFloor.updateMany({
          where: {
            id: { in: settledFloorIds },
            status: { in: ["DELIVERY_APPROVED", "INVOICED", "COMPLETED"] },
          },
          data: { status: "DEAL_COMPLETED" },
        });
      }
    }

    // 受注者に支払い完了通知
    const contractorUsers = await tx.user.findMany({
      where: { companyId: doc.workerCompanyId, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (contractorUsers.length > 0) {
      await tx.notification.createMany({
        data: contractorUsers.map((u) => ({
          userId: u.id,
          title: "支払い完了",
          content: `${doc.yearMonth?.substring(0, 4)}年${doc.yearMonth?.substring(4)}月分の支払いが完了しました`,
          type: 43,
          targetId: documentId,
        })),
      });
    }
  });

  return { success: true };
}

const progressDetailSelect = {
  id: true,
  appliedAt: true,
  billingMonth: true,
  amount: true,
  kind: true,
  factoryFloorOrder: {
    select: {
      factoryFloor: { select: { name: true, code: true, parent: { select: { code: true, name: true } } } },
      documents: {
        where: { type: "ORDER_SHEET" as const, status: { not: "VOID" as const }, deletedAt: null },
        orderBy: { createdAt: "desc" as const },
        select: { pdfUrl: true, documentNumber: true },
      },
    },
  },
} as const;

type ProgressDetail = {
  id: string;
  appliedAt: Date;
  billingMonth: string;
  amount: bigint;
  kind: "PARTIAL" | "FINAL";
  factoryFloorOrder: {
    factoryFloor: { name: string | null; code: string | null; parent: { code: string | null; name: string | null } | null };
    documents: { pdfUrl: string | null; documentNumber: string | null }[];
  };
};

/** 出来高を請求書詳細の行の形に（orderId = "pb:<出来高ID>" のキー） */
function progressDetailRow(p: ProgressDetail) {
  const floor = p.factoryFloorOrder.factoryFloor;
  const sheet = p.factoryFloorOrder.documents[0] ?? null;
  const subtotal = Number(p.amount);
  return {
    orderId: `${PROGRESS_KEY_PREFIX}${p.id}`,
    siteName: progressLineName(floor.name ?? "", p.billingMonth, p.kind),
    parentSiteName: floor.parent?.name ?? "",
    siteCode: floor.code ?? floor.parent?.code ?? "",
    documentNumber: sheet?.documentNumber ?? "",
    subtotal,
    amount: subtotal + progressTax(subtotal),
    orderSheetPdfUrl: sheet?.pdfUrl ?? null,
  };
}

/** 明細キーを発注IDと出来高IDに分ける */
function splitRowKeys(keys: string[]) {
  const orderIds: string[] = [];
  const progressIds: string[] = [];
  for (const k of keys) {
    if (k.startsWith(PROGRESS_KEY_PREFIX)) progressIds.push(k.slice(PROGRESS_KEY_PREFIX.length));
    else orderIds.push(k);
  }
  return { orderIds, progressIds };
}

/**
 * 請求書に含まれる発注・出来高の一覧（注文書PDF付き）。
 * 「含まれる発注」の各項目タップで注文書を開くために metadata.orderIds / progressBillingIds を解決する。
 * orderId は明細キー（発注ID or "pb:<出来高ID>"）。
 */
export async function getInvoiceOrderRows(documentId: string) {
  const user = await requireSession();
  const doc = await prisma.document.findFirst({
    where: {
      id: documentId, type: "INVOICE", deletedAt: null,
      OR: [{ orderCompanyId: user.companyId }, { workerCompanyId: user.companyId }],
    },
    select: { metadata: true },
  });
  if (!doc) return [];
  const meta = doc.metadata as Record<string, unknown> | null;
  const orderIds = (meta?.orderIds as string[]) ?? [];
  const progressIds = (meta?.progressBillingIds as string[]) ?? [];
  if (orderIds.length === 0 && progressIds.length === 0) return [];

  const [orders, progress] = await Promise.all([
    prisma.factoryFloorOrder.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        factoryFloor: { select: { name: true, code: true, parent: { select: { code: true, name: true } } } },
        documents: {
          where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { pdfUrl: true, documentNumber: true, subtotal: true, totalAmount: true },
        },
      },
    }),
    progressIds.length
      ? prisma.progressBilling.findMany({ where: { id: { in: progressIds } }, select: progressDetailSelect })
      : Promise.resolve([]),
  ]);
  const byId = new Map(orders.map((o) => [o.id, o]));
  const orderRows = orderIds.map((id) => {
    const o = byId.get(id);
    const sheet = o?.documents[0] ?? null;
    return {
      orderId: id,
      siteName: o?.factoryFloor.name ?? "",
      parentSiteName: o?.factoryFloor.parent?.name ?? "",
      siteCode: o?.factoryFloor.code ?? o?.factoryFloor.parent?.code ?? "",
      documentNumber: sheet?.documentNumber ?? "",
      // subtotal=税抜(表内の明細表示用) / amount=税込合計(再作成プレビューの合計用)
      subtotal: (o?.documents ?? []).reduce((s, d) => s + Number(d.subtotal ?? 0), 0),
      amount: (o?.documents ?? []).reduce((s, d) => s + Number(d.totalAmount ?? 0), 0),
      orderSheetPdfUrl: sheet?.pdfUrl ?? null,
    };
  });
  const progressById = new Map(progress.map((p) => [p.id, p]));
  const progressRows = progressIds
    .map((id) => progressById.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map(progressDetailRow);
  return [...orderRows, ...progressRows];
}

/**
 * この請求書に追加できる発注・出来高（同じ取引先・締め完了(CLOSED)/確定済みの出来高・未請求）。
 * 二重請求防止のため、既存の非VOID請求書に含まれるものは除外する。
 */
export async function getAddableOrders(documentId: string) {
  const user = await requireSession();
  const doc = await prisma.document.findFirst({
    where: {
      id: documentId, type: "INVOICE", deletedAt: null,
      OR: [{ orderCompanyId: user.companyId }, { workerCompanyId: user.companyId }],
    },
    select: { orderCompanyId: true, workerCompanyId: true },
  });
  if (!doc) return [];

  const [orders, progress, invoiced, invoicedProgress] = await Promise.all([
    prisma.factoryFloorOrder.findMany({
      where: {
        deletedAt: null, status: "CONFIRMED", completionStatus: "CLOSED",
        workCompanyId: doc.workerCompanyId,
        factoryFloor: { companyId: doc.orderCompanyId, deletedAt: null },
        // 出来高を確定済みの発注書は出来高の行で追加する
        progressBillings: { none: { status: "CONFIRMED" } },
      },
      select: {
        id: true, completedDay: true,
        factoryFloor: { select: { name: true, code: true, parent: { select: { code: true, name: true } } } },
        documents: {
          where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
          select: { subtotal: true, totalAmount: true },
        },
      },
      orderBy: { completedDay: "desc" },
    }),
    prisma.progressBilling.findMany({
      where: {
        status: "CONFIRMED",
        factoryFloorOrder: {
          deletedAt: null,
          workCompanyId: doc.workerCompanyId,
          factoryFloor: { companyId: doc.orderCompanyId, deletedAt: null },
        },
      },
      select: progressDetailSelect,
      orderBy: { appliedAt: "desc" },
    }),
    getInvoicedOrderIds({ companyIdEitherSide: user.companyId }),
    getInvoicedProgressIds({ companyIdEitherSide: user.companyId }),
  ]);

  const orderRows = orders
    .filter((o) => o.documents.length > 0 && !invoiced.has(o.id))
    .map((o) => ({
      orderId: o.id,
      siteName: o.factoryFloor.name ?? "",
      parentSiteName: o.factoryFloor.parent?.name ?? "",
      siteCode: o.factoryFloor.code ?? o.factoryFloor.parent?.code ?? "",
      // subtotal=税抜(表内の明細表示用) / amount=税込合計(再作成プレビューの合計用)
      subtotal: o.documents.reduce((s, d) => s + Number(d.subtotal ?? 0), 0),
      amount: o.documents.reduce((s, d) => s + Number(d.totalAmount ?? 0), 0),
      completedDay: o.completedDay?.toISOString() ?? null,
    }));
  const progressRows = progress
    .filter((p) => !invoicedProgress.has(p.id))
    .map((p) => {
      const { orderSheetPdfUrl: _pdf, documentNumber: _num, ...row } = progressDetailRow(p);
      return { ...row, completedDay: p.appliedAt.toISOString() };
    });
  return [...orderRows, ...progressRows];
}

/**
 * 発注・出来高のセットを編集して請求書を作り直す（追加/削除の反映）。
 * 旧請求書をVOIDにし、新しいセットで請求書を再作成する。
 * orderIds は明細キー（発注ID or "pb:<出来高ID>"）。
 * 支払済み(CONFIRMED)・無効(VOID)は編集不可。異なる取引先の発注は混在不可。
 */
export async function rebuildInvoiceFromOrders(documentId: string, orderIds: string[]) {
  const user = await requireSession();
  const doc = await prisma.document.findFirst({
    where: {
      id: documentId, type: "INVOICE", deletedAt: null,
      OR: [{ orderCompanyId: user.companyId }, { workerCompanyId: user.companyId }],
    },
    select: { id: true, status: true, issuedAt: true, dueDate: true, orderCompanyId: true, workerCompanyId: true },
  });
  if (!doc) throw new Error("請求書が見つかりません");
  // 確定済み(ISSUED)・支払済み(CONFIRMED)・無効(VOID)は編集不可。確認待ち(DRAFT)のみ編集可。
  if (doc.status !== "DRAFT") throw new Error("確定済みの請求書は編集できません");
  const keys = [...new Set(orderIds)];
  if (keys.length === 0) throw new Error("発注を1件以上選択してください");
  const { orderIds: ids, progressIds } = splitRowKeys(keys);

  const [orders, progress] = await Promise.all([
    prisma.factoryFloorOrder.findMany({
      where: { id: { in: ids }, deletedAt: null, completionStatus: "CLOSED" },
      select: { id: true, workCompanyId: true, factoryFloor: { select: { companyId: true } } },
    }),
    prisma.progressBilling.findMany({
      where: { id: { in: progressIds }, status: "CONFIRMED" },
      select: {
        id: true,
        factoryFloorOrder: { select: { workCompanyId: true, factoryFloor: { select: { companyId: true } } } },
      },
    }),
  ]);
  if (orders.length !== ids.length) throw new Error("締め完了していない発注が含まれています");
  if (progress.length !== progressIds.length) throw new Error("確定していない出来高が含まれています");
  const mismatch =
    orders.some(
      (o) => o.workCompanyId !== doc.workerCompanyId || o.factoryFloor.companyId !== doc.orderCompanyId
    ) ||
    progress.some(
      (p) =>
        p.factoryFloorOrder.workCompanyId !== doc.workerCompanyId ||
        p.factoryFloorOrder.factoryFloor.companyId !== doc.orderCompanyId
    );
  if (mismatch) throw new Error("この請求書と異なる取引先の発注は追加できません");

  const billingDate = doc.issuedAt ?? new Date();
  // 生成時点で旧請求書(documentId)はまだ非VOIDのため、自分自身の発注が二重請求ガードで
  // 落ちないよう excludeInvoiceIds に渡す（他の請求書に載る発注は除外される）。
  const newDocId = await generateInvoiceFromOrders(ids, billingDate, [documentId], progressIds);

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: newDocId },
      data: { status: doc.status, ...(doc.dueDate ? { dueDate: doc.dueDate } : {}) },
    });
    await tx.document.update({
      where: { id: documentId },
      data: { status: "VOID", deletedAt: new Date() },
    });
  });

  return { id: newDocId };
}
