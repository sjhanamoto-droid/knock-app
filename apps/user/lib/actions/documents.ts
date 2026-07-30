"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

/**
 * 帳票一覧を取得（種類別・月別フィルタ対応）
 */
export async function getDocuments(filters?: {
  type?: "ORDER_SHEET" | "DELIVERY_NOTE" | "INVOICE";
  yearMonth?: string;
  counterpartyCompanyId?: string;
  page?: number;
  limit?: number;
}) {
  const user = await requireSession();
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 20;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    deletedAt: null,
    OR: [
      { orderCompanyId: user.companyId },
      { workerCompanyId: user.companyId },
    ],
  };

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.counterpartyCompanyId) {
    // 取引先フィルター: 自社が発注者の場合は受注者で絞り込み、逆も
    where.AND = [
      {
        OR: [
          { orderCompanyId: filters.counterpartyCompanyId },
          { workerCompanyId: filters.counterpartyCompanyId },
        ],
      },
    ];
  }

  if (filters?.yearMonth) {
    const year = parseInt(filters.yearMonth.substring(0, 4));
    const month = parseInt(filters.yearMonth.substring(4, 6));
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    where.issuedAt = { gte: startOfMonth, lte: endOfMonth };
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip,
      take: limit,
      include: {
        orderCompany: { select: { id: true, name: true } },
        workerCompany: { select: { id: true, name: true } },
        factoryFloorOrder: {
          select: {
            factoryFloor: {
              select: {
                id: true,
                name: true,
                code: true,
                parent: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.document.count({ where }),
  ]);

  // 注文書ごとの「請求済み」判定に使う、請求済み発注IDの集合を作る。
  // 請求書(INVOICE, 非VOID)の metadata.orderIds に、その請求書へまとめられた発注IDが入る。
  const invoicedOrderIds = new Set<string>();
  if (documents.some((d) => d.type === "ORDER_SHEET")) {
    const invoices = await prisma.document.findMany({
      where: {
        type: "INVOICE",
        status: { not: "VOID" },
        deletedAt: null,
        OR: [
          { orderCompanyId: user.companyId },
          { workerCompanyId: user.companyId },
        ],
      },
      select: { metadata: true },
    });
    for (const inv of invoices) {
      const ids = (inv.metadata as { orderIds?: string[] } | null)?.orderIds ?? [];
      for (const id of ids) invoicedOrderIds.add(id);
    }
  }

  return {
    documents: documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      status: doc.status,
      documentNumber: doc.documentNumber,
      totalAmount: doc.totalAmount ? Number(doc.totalAmount) : null,
      issuedAt: doc.issuedAt,
      pdfUrl: doc.pdfUrl,
      orderCompanyName: doc.orderCompany.name,
      workerCompanyName: doc.workerCompany.name,
      siteId: doc.factoryFloorOrder?.factoryFloor?.id ?? null,
      siteName: doc.factoryFloorOrder?.factoryFloor?.name ?? "",
      parentSiteName: doc.factoryFloorOrder?.factoryFloor?.parent?.name ?? null,
      // 工事番号は子工事なら親のコードを継承する
      siteCode:
        doc.factoryFloorOrder?.factoryFloor?.code ??
        doc.factoryFloorOrder?.factoryFloor?.parent?.code ??
        "",
      isMyCompanyOrderer: doc.orderCompanyId === user.companyId,
      // 請求書発行済みか（注文書のみ判定。請求前=false / 請求済=true）
      isInvoiced:
        doc.type === "ORDER_SHEET"
          ? invoicedOrderIds.has(doc.factoryFloorOrderId)
          : false,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 帳票詳細を取得
 */
export async function getDocumentDetail(documentId: string) {
  const user = await requireSession();

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
      OR: [
        { orderCompanyId: user.companyId },
        { workerCompanyId: user.companyId },
      ],
    },
    include: {
      orderCompany: {
        select: {
          id: true, name: true, postalCode: true, prefecture: true,
          city: true, streetAddress: true, building: true, invoiceNumber: true,
        },
      },
      workerCompany: {
        select: {
          id: true, name: true, postalCode: true, prefecture: true,
          city: true, streetAddress: true, building: true, invoiceNumber: true,
          bankName: true, bankBranchName: true, bankAccountType: true,
          bankAccountNumber: true, bankAccountName: true,
        },
      },
      factoryFloorOrder: {
        include: {
          factoryFloor: {
            select: {
              id: true, name: true, address: true,
              startDayRequest: true, endDayRequest: true,
              parent: { select: { name: true } },
              priceDetails: { where: { deletedAt: null }, include: { unit: true } },
            },
          },
        },
      },
    },
  });

  if (!document) throw new Error("帳票が見つかりません");

  // プレビュー画面の金額欄に表示する明細。小計・合計と必ず一致させる。
  // 1) 新しい帳票は metadata.lineItems(PDF本文と同じ明細)を使用。
  // 2) 旧・追加注文書は追加工事の明細(inspectionData)を使用(元工事ではなく追加分のみ)。
  // 3) それ以外(旧・通常注文書)は現場の明細にフォールバック。
  type MetaLineItem = { name?: string; quantity?: number; unit?: string; priceUnit?: number; additional?: boolean };
  type InspectionLineData = {
    type?: string;
    priceDetails?: { name: string; quantity: number; unitId?: string; priceUnit: number; specifications?: string }[];
  };
  const meta = (document.metadata as { lineItems?: MetaLineItem[] } | null) ?? {};
  const inspection = document.factoryFloorOrder?.inspectionData as InspectionLineData | null;
  const isAdditionalOrder = inspection?.type === "ADDITIONAL_ORDER";

  let lineItems: { name: string; quantity: number; unit: string; priceUnit: number; additional: boolean }[];
  if (meta.lineItems && meta.lineItems.length > 0) {
    lineItems = meta.lineItems.map((p) => ({
      name: p.name ?? "",
      quantity: Number(p.quantity ?? 0),
      unit: p.unit ?? "",
      priceUnit: Number(p.priceUnit ?? 0),
      additional: !!p.additional,
    }));
  } else if (isAdditionalOrder && inspection?.priceDetails?.length) {
    // 単位名を解決
    const unitIds = inspection.priceDetails.map((p) => p.unitId).filter(Boolean) as string[];
    const units = unitIds.length > 0
      ? await prisma.unit.findMany({ where: { id: { in: unitIds } } })
      : [];
    const unitMap = new Map(units.map((u) => [u.id, u.name]));
    lineItems = inspection.priceDetails.map((p) => ({
      name: p.name ?? "",
      quantity: Number(p.quantity ?? 0),
      unit: p.unitId ? (unitMap.get(p.unitId) ?? "") : "",
      priceUnit: Number(p.priceUnit ?? 0),
      additional: true,
    }));
  } else {
    lineItems = (document.factoryFloorOrder?.factoryFloor?.priceDetails ?? []).map((p) => ({
      name: p.name ?? "",
      quantity: Number(p.quantity ?? 0),
      unit: p.unit?.name ?? "",
      priceUnit: Number(p.priceUnit ?? 0),
      additional: false,
    }));
  }

  return {
    ...document,
    subtotal: document.subtotal ? Number(document.subtotal) : null,
    taxAmount: document.taxAmount ? Number(document.taxAmount) : null,
    totalAmount: document.totalAmount ? Number(document.totalAmount) : null,
    lineItems,
  };
}

/**
 * 帳票の取引先（会社）一覧を取得
 */
export async function getDocumentCounterparties() {
  const user = await requireSession();

  const documents = await prisma.document.findMany({
    where: {
      deletedAt: null,
      OR: [
        { orderCompanyId: user.companyId },
        { workerCompanyId: user.companyId },
      ],
    },
    select: {
      orderCompanyId: true,
      workerCompanyId: true,
      orderCompany: { select: { id: true, name: true } },
      workerCompany: { select: { id: true, name: true } },
    },
  });

  // 自社以外の取引先をユニークに抽出
  const map = new Map<string, string>();
  for (const doc of documents) {
    if (doc.orderCompanyId !== user.companyId) {
      map.set(doc.orderCompanyId, doc.orderCompany.name ?? "");
    }
    if (doc.workerCompanyId !== user.companyId) {
      map.set(doc.workerCompanyId, doc.workerCompany.name ?? "");
    }
  }

  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}
