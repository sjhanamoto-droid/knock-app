import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { generateOrderSheetPdf, type OrderSheetPdfData } from "./order-sheet-pdf";
import { generateInvoicePdf, type InvoicePdfData } from "./invoice-pdf";
import { getBillingPeriod, getBillingMonth, toJstCalendarDate } from "@/lib/helpers/billing-period";
import { getInvoicedOrderIds, getInvoicedProgressIds } from "@/lib/helpers/invoiced-orders";
import { PROGRESS_KEY_PREFIX, progressLineName, progressTax } from "@/lib/helpers/progress-billing";
import { calcOrderSubtotal, calcTax } from "@/lib/helpers/order-amount";

/**
 * 帳票番号の自動採番
 * FORMAT: {TYPE_PREFIX}-{YYYYMM}-{SEQ}
 */
async function generateDocumentNumber(
  type: "ORDER_SHEET" | "ORDER_ACCEPTANCE" | "DELIVERY_NOTE" | "INVOICE",
  yearMonthOverride?: string,
): Promise<string> {
  const prefix = {
    ORDER_SHEET: "ORD",
    ORDER_ACCEPTANCE: "ACC",
    DELIVERY_NOTE: "DLV",
    INVOICE: "INV",
  }[type];

  const now = new Date();
  // 請求書は締め月(yearMonthOverride)で採番する。指定が無ければ発行日ベース。
  const yearMonth =
    yearMonthOverride ?? `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const count = await prisma.document.count({
    where: {
      type,
      documentNumber: { startsWith: `${prefix}-${yearMonth}` },
    },
  });

  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}-${yearMonth}-${seq}`;
}

/**
 * PDFデータURIを返す（サーバーレス環境対応）
 * Vercel等のread-onlyファイルシステムではファイル書き込みできないため、
 * data URIをそのまま返してDBに保存する。
 */
export function savePdfToFile(pdfDataUri: string, _documentNumber: string): string {
  return pdfDataUri;
}

/**
 * 印鑑画像URLからbase64文字列を読み込む
 * data URI形式（data:image/png;base64,...）の場合はそのまま返す
 */
function loadStampImageBase64(stampImageUrl: string | null | undefined): string | undefined {
  if (!stampImageUrl) return undefined;

  // data URI の場合はそのまま返す（jsPDFがdata URIを直接処理可能）
  if (stampImageUrl.startsWith("data:")) {
    return stampImageUrl;
  }

  // ファイルパスの場合は従来通り読み込み
  try {
    const relativePath = stampImageUrl.replace(/^\//, "");
    let filePath = path.join(process.cwd(), "public", relativePath);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), "apps/user/public", relativePath);
    }
    if (!fs.existsSync(filePath)) return undefined;
    return fs.readFileSync(filePath).toString("base64");
  } catch {
    return undefined;
  }
}

function buildAddress(company: {
  postalCode?: string | null;
  prefecture?: string | null;
  city?: string | null;
  streetAddress?: string | null;
  building?: string | null;
} | null): string {
  if (!company) return "";
  return [
    company.prefecture ?? "",
    company.city ?? "",
    company.streetAddress ?? "",
    company.building ?? "",
  ].filter(Boolean).join(" ");
}

/**
 * 請求書の発行日 = 含める発注のうち最も遅い完了日(施工報告の送信日)。
 * 作成操作をした日ではなく、施工完了の日付を請求書に載せる（例: 9/30完了分を10/1に作成しても 9/30）。
 * 完了日はすべて請求期間内なので、発行日が未来日や対象月外になることはない。
 */
function latestCompletedDay(orders: { completedDay: Date | null }[], fallback: Date): Date {
  const days = orders.map((o) => o.completedDay).filter((d): d is Date => d !== null);
  if (days.length === 0) return fallback;
  return new Date(Math.max(...days.map((d) => d.getTime())));
}

/**
 * 注文書を自動生成（発注確定時 / 追加工事時にトリガー）
 */
export async function generateOrderSheet(orderId: string): Promise<string> {
  const order = await prisma.factoryFloorOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      factoryFloor: {
        include: {
          company: true,
          workCompany: true,
          parent: { select: { name: true, code: true } },
          priceDetails: { where: { deletedAt: null }, include: { unit: true } },
        },
      },
    },
  });

  const floor = order.factoryFloor;
  // 工事名は「親工事名_工事名」の形式（例: 練馬ビル改修工事_電気工事）。
  // 親がない単体現場は工事名のみ。
  const fullSiteName = floor.parent?.name
    ? [floor.parent.name, floor.name].filter(Boolean).join("_")
    : (floor.name ?? "");
  const documentNumber = await generateDocumentNumber("ORDER_SHEET");
  const issuedAt = new Date();

  // 追加注文の場合: inspectionData から明細を取得
  type AdditionalOrderData = {
    type?: string;
    priceDetails?: { name: string; quantity: number; unitId?: string; priceUnit: number; specifications?: string }[];
  };
  const additionalData = order.inspectionData as AdditionalOrderData | null;
  const isAdditionalOrder = additionalData?.type === "ADDITIONAL_ORDER";

  let pdfPriceDetails: { name: string; specifications: string; quantity: number; unit: string; priceUnit: number }[];

  if (isAdditionalOrder && additionalData.priceDetails?.length) {
    // 追加注文: unitId から unit 名を解決
    const unitIds = additionalData.priceDetails.map((p) => p.unitId).filter(Boolean) as string[];
    const units = unitIds.length > 0
      ? await prisma.unit.findMany({ where: { id: { in: unitIds } } })
      : [];
    const unitMap = new Map(units.map((u) => [u.id, u.name]));

    pdfPriceDetails = additionalData.priceDetails.map((p) => ({
      name: p.name,
      specifications: p.specifications ?? "",
      quantity: p.quantity,
      unit: p.unitId ? (unitMap.get(p.unitId) ?? "") : "",
      priceUnit: p.priceUnit,
    }));
  } else {
    // 通常注文: floor.priceDetails を使用
    pdfPriceDetails = floor.priceDetails.map((p) => ({
      name: p.name ?? "",
      specifications: p.specifications ?? "",
      quantity: p.quantity ?? 0,
      unit: p.unit?.name ?? "",
      priceUnit: Number(p.priceUnit ?? 0),
    }));
  }

  // 金額はホーム画面の表示と同じヘルパーで計算する
  const subtotal = calcOrderSubtotal({
    isAdditional: isAdditionalOrder,
    additionalDetails: additionalData?.priceDetails,
    floorDetails: floor.priceDetails,
    floorTotalAmount: floor.totalAmount,
  });
  const taxAmount = calcTax(subtotal);
  const totalAmount = BigInt(Number(subtotal)) + taxAmount;

  // 担当者名（現場作成者）
  const createdUser = await prisma.user.findUnique({
    where: { id: floor.createdUserId },
    select: { lastName: true, firstName: true },
  });
  const contactName = createdUser
    ? `${createdUser.lastName ?? ""}${createdUser.firstName ?? ""}`.trim()
    : "";

  // PDF生成データ
  const pdfData: OrderSheetPdfData = {
    documentNumber,
    issuedAt,
    // 受注者（宛先）
    workerCompanyName: floor.workCompany?.name ?? "",
    workerCompanyAddress: buildAddress(floor.workCompany),
    workerCompanyTel: floor.workCompany?.telNumber ?? "",
    workerCompanyFax: "",
    contactPersonName: contactName,
    // 発注者（発行元）
    orderCompanyName: floor.company?.name ?? "",
    orderCompanyPostalCode: floor.company?.postalCode ?? "",
    orderCompanyAddress: buildAddress(floor.company),
    orderCompanyTel: floor.company?.telNumber ?? "",
    orderCompanyRepresentative: "",
    // 現場情報
    siteName: fullSiteName,
    siteCode: floor.code ?? floor.parent?.code ?? "",
    workStartDay: floor.startDayRequest,
    workEndDay: floor.endDayRequest,
    // 明細
    priceDetails: pdfPriceDetails,
    subtotal: Number(subtotal),
    taxAmount10: Number(taxAmount),
    totalAmount: Number(totalAmount),
    remarks: isAdditionalOrder ? "追加工事" : (floor.remarks ?? ""),
    stampImageBase64: loadStampImageBase64(floor.company?.stampImage),
  };

  // PDF生成 → ファイル保存
  const pdfDataUrl = generateOrderSheetPdf(pdfData);
  const pdfFilePath = savePdfToFile(pdfDataUrl, documentNumber);

  const document = await prisma.document.create({
    data: {
      type: "ORDER_SHEET",
      status: "ISSUED",
      documentNumber,
      factoryFloorOrderId: orderId,
      orderCompanyId: floor.companyId,
      workerCompanyId: floor.workCompanyId!,
      subtotal,
      taxAmount,
      totalAmount,
      invoiceNumber: floor.company?.invoiceNumber,
      pdfUrl: pdfFilePath,
      issuedAt,
      metadata: {
        siteName: fullSiteName,
        siteAddress: floor.address,
        contentRequest: floor.contentRequest,
        startDate: floor.startDayRequest?.toISOString(),
        endDate: floor.endDayRequest?.toISOString(),
        orderCompanyName: floor.company?.name,
        orderCompanyAddress: [
          floor.company?.postalCode ? `〒${floor.company.postalCode}` : "",
          floor.company?.prefecture ?? "",
          floor.company?.city ?? "",
          floor.company?.streetAddress ?? "",
          floor.company?.building ?? "",
        ].filter(Boolean).join(" "),
        workerCompanyName: floor.workCompany?.name,
        workerCompanyAddress: [
          floor.workCompany?.postalCode ? `〒${floor.workCompany.postalCode}` : "",
          floor.workCompany?.prefecture ?? "",
          floor.workCompany?.city ?? "",
          floor.workCompany?.streetAddress ?? "",
          floor.workCompany?.building ?? "",
        ].filter(Boolean).join(" "),
        priceDetails: floor.priceDetails.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          unit: p.unit?.name ?? "",
          priceUnit: Number(p.priceUnit),
        })),
        // プレビュー画面の金額欄用: PDF本文と同じ明細(追加工事の場合は追加明細)
        lineItems: pdfPriceDetails.map((p) => ({
          name: p.name,
          specifications: p.specifications,
          quantity: p.quantity,
          unit: p.unit,
          priceUnit: p.priceUnit,
        })),
        // 注文請書の備考用
        remarks: pdfData.remarks,
      },
    },
  });

  // 注文請書を同時に作成（注文書と同内容で発注者/受注者を入れ替えたもの）。
  // 失敗しても注文書・発注確定は成立させる（再生成は scripts/backfill-order-acceptance.ts）。
  try {
    await generateOrderAcceptance(document.id);
  } catch (e) {
    console.error("[generateOrderSheet] generateOrderAcceptance failed:", e);
  }

  return document.id;
}

/**
 * 注文請書を生成（注文書と同時に作成）。
 * 注文書(ORDER_SHEET)の保存内容をそのまま使い、宛先=発注者 / 発行元=受注者(受注者の印鑑)にする。
 * 既に作成済みならその ID を返す（冪等。既存注文書へのバックフィルにも使用）。
 * regenerate=true のときは作成済みの注文請書のPDFを請書番号はそのままで作り直す（レイアウト変更の反映用）。
 */
export async function generateOrderAcceptance(
  orderSheetId: string,
  options: { regenerate?: boolean } = {},
): Promise<string> {
  const existing = await prisma.document.findFirst({
    where: {
      type: "ORDER_ACCEPTANCE",
      deletedAt: null,
      metadata: { path: ["orderSheetId"], equals: orderSheetId },
    },
    select: { id: true, documentNumber: true },
  });
  if (existing && !options.regenerate) return existing.id;

  const sheet = await prisma.document.findUniqueOrThrow({
    where: { id: orderSheetId },
    include: {
      orderCompany: true,
      workerCompany: true,
      factoryFloorOrder: {
        select: {
          factoryFloor: {
            select: {
              code: true,
              remarks: true,
              startDayRequest: true,
              endDayRequest: true,
              parent: { select: { code: true } },
            },
          },
        },
      },
    },
  });
  if (sheet.type !== "ORDER_SHEET") throw new Error("注文書ではありません");

  type SheetLineItem = { name?: string; specifications?: string; quantity?: number; unit?: string; priceUnit?: number };
  type SheetMeta = {
    siteName?: string;
    lineItems?: SheetLineItem[];
    priceDetails?: SheetLineItem[]; // 旧注文書(lineItems 導入前)
    remarks?: string;
  };
  const meta = (sheet.metadata as SheetMeta | null) ?? {};
  const floor = sheet.factoryFloorOrder.factoryFloor;

  const issuedAt = sheet.issuedAt ?? sheet.createdAt;
  const yearMonth = `${issuedAt.getFullYear()}${String(issuedAt.getMonth() + 1).padStart(2, "0")}`;
  const documentNumber =
    existing?.documentNumber ?? (await generateDocumentNumber("ORDER_ACCEPTANCE", yearMonth));

  const pdfData: OrderSheetPdfData = {
    variant: "ORDER_ACCEPTANCE",
    documentNumber,
    orderSheetNumber: sheet.documentNumber,
    issuedAt,
    // 受注者（発行元）
    workerCompanyName: sheet.workerCompany.name ?? "",
    workerCompanyPostalCode: sheet.workerCompany.postalCode ?? "",
    workerCompanyAddress: buildAddress(sheet.workerCompany),
    workerCompanyTel: sheet.workerCompany.telNumber ?? "",
    workerCompanyFax: "",
    // 注文請書には担当者を記載しない
    contactPersonName: "",
    // 発注者（宛先）
    orderCompanyName: sheet.orderCompany.name ?? "",
    orderCompanyPostalCode: sheet.orderCompany.postalCode ?? "",
    orderCompanyAddress: buildAddress(sheet.orderCompany),
    orderCompanyTel: sheet.orderCompany.telNumber ?? "",
    orderCompanyRepresentative: "",
    siteName: meta.siteName ?? "",
    siteCode: floor.code ?? floor.parent?.code ?? "",
    workStartDay: floor.startDayRequest,
    workEndDay: floor.endDayRequest,
    priceDetails: (meta.lineItems ?? meta.priceDetails ?? []).map((p) => ({
      name: p.name ?? "",
      specifications: p.specifications ?? "",
      quantity: Number(p.quantity ?? 0),
      unit: p.unit ?? "",
      priceUnit: Number(p.priceUnit ?? 0),
    })),
    subtotal: Number(sheet.subtotal ?? 0),
    taxAmount10: Number(sheet.taxAmount ?? 0),
    totalAmount: Number(sheet.totalAmount ?? 0),
    remarks: meta.remarks ?? floor.remarks ?? "",
    stampImageBase64: loadStampImageBase64(sheet.workerCompany.stampImage),
  };

  const pdfDataUrl = generateOrderSheetPdf(pdfData);
  const pdfFilePath = savePdfToFile(pdfDataUrl, documentNumber);

  if (existing) {
    await prisma.document.update({ where: { id: existing.id }, data: { pdfUrl: pdfFilePath } });
    return existing.id;
  }

  const acceptance = await prisma.document.create({
    data: {
      type: "ORDER_ACCEPTANCE",
      status: "ISSUED",
      documentNumber,
      factoryFloorOrderId: sheet.factoryFloorOrderId,
      orderCompanyId: sheet.orderCompanyId,
      workerCompanyId: sheet.workerCompanyId,
      subtotal: sheet.subtotal,
      taxAmount: sheet.taxAmount,
      totalAmount: sheet.totalAmount,
      invoiceNumber: sheet.workerCompany.invoiceNumber,
      pdfUrl: pdfFilePath,
      issuedAt,
      metadata: {
        ...(meta as Record<string, unknown>),
        orderSheetId: sheet.id,
        orderSheetNumber: sheet.documentNumber,
      },
    },
  });

  return acceptance.id;
}

/**
 * 請求書の明細1行（合算の単位）。
 * - ORDER: 施工報告で完了(CLOSED)した発注書。注文書金額をそのまま請求（完了日の締め月）
 * - PROGRESS: 発注者が確定した出来高。金額(税抜)を申請月に請求（表記「工事名 出来高[10月分]」）
 * 出来高を確定済みの発注書は ORDER として重複請求しない（getBillableOrdersForInvoice で除外）。
 */
export type InvoiceRow = {
  /** 請求書内で一意のキー（発注ID or "pb:<出来高ID>"）。請求書詳細の追加/削除にも使う */
  key: string;
  type: "ORDER" | "PROGRESS";
  orderId: string;
  progressBillingId: string | null;
  /** 明細の日付（完了日 / 出来高の申請日） */
  date: Date | null;
  /** 明細の工事名（出来高は「工事名 出来高[10月分]」） */
  siteName: string;
  parentSiteName: string | null;
  siteCode: string;
  documentNumber: string;
  /** 出来高の請求月(YYYYMM)・種別 */
  billingMonth: string | null;
  progressKind: "PARTIAL" | "FINAL" | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
};

type OrderForRow = {
  id: string;
  completedDay: Date | null;
  factoryFloor: {
    name: string | null;
    code: string | null;
    parent: { code: string | null; name?: string | null } | null;
  };
  documents: {
    documentNumber: string | null;
    subtotal: bigint | null;
    taxAmount: bigint | null;
    totalAmount: bigint | null;
    metadata: unknown;
  }[];
};

function orderRow(order: OrderForRow): InvoiceRow {
  const sheet = order.documents[0];
  const sum = (key: "subtotal" | "taxAmount" | "totalAmount") =>
    order.documents.reduce((s, d) => s + Number(d[key] ?? 0), 0);
  return {
    key: order.id,
    type: "ORDER",
    orderId: order.id,
    progressBillingId: null,
    date: order.completedDay,
    siteName:
      order.factoryFloor.name ??
      ((sheet?.metadata as Record<string, unknown> | null)?.siteName as string) ??
      "",
    parentSiteName: order.factoryFloor.parent?.name ?? null,
    siteCode: order.factoryFloor.code ?? order.factoryFloor.parent?.code ?? "",
    documentNumber: sheet?.documentNumber ?? "",
    billingMonth: null,
    progressKind: null,
    // 明細行の金額は税抜(小計)で表示する。小計・消費税・合計は別途集計。
    subtotal: sum("subtotal"),
    taxAmount: sum("taxAmount"),
    totalAmount: sum("totalAmount"),
  };
}

const progressRowSelect = {
  id: true,
  appliedAt: true,
  billingMonth: true,
  amount: true,
  kind: true,
  factoryFloorOrderId: true,
  factoryFloorOrder: {
    select: {
      workCompanyId: true,
      factoryFloor: {
        select: {
          companyId: true,
          name: true,
          code: true,
          parent: { select: { code: true, name: true } },
        },
      },
      documents: {
        where: { type: "ORDER_SHEET" as const, status: { not: "VOID" as const }, deletedAt: null },
        select: { documentNumber: true, metadata: true },
      },
    },
  },
} as const;

type ProgressForRow = {
  id: string;
  appliedAt: Date;
  billingMonth: string;
  amount: bigint;
  kind: "PARTIAL" | "FINAL";
  factoryFloorOrderId: string;
  factoryFloorOrder: {
    factoryFloor: {
      name: string | null;
      code: string | null;
      parent: { code: string | null; name: string | null } | null;
    };
    documents: { documentNumber: string | null; metadata: unknown }[];
  };
};

function progressRow(p: ProgressForRow): InvoiceRow {
  const floor = p.factoryFloorOrder.factoryFloor;
  const sheet = p.factoryFloorOrder.documents[0];
  const baseName =
    floor.name ?? ((sheet?.metadata as Record<string, unknown> | null)?.siteName as string) ?? "";
  const subtotal = Number(p.amount);
  const taxAmount = progressTax(subtotal);
  return {
    key: `${PROGRESS_KEY_PREFIX}${p.id}`,
    type: "PROGRESS",
    orderId: p.factoryFloorOrderId,
    progressBillingId: p.id,
    date: toJstCalendarDate(p.appliedAt),
    siteName: progressLineName(baseName, p.billingMonth, p.kind),
    parentSiteName: floor.parent?.name ?? null,
    siteCode: floor.code ?? floor.parent?.code ?? "",
    documentNumber: sheet?.documentNumber ?? "",
    billingMonth: p.billingMonth,
    progressKind: p.kind,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
  };
}

/**
 * 月次請求書に合算する発注（請求対象）を抽出する。
 * generateInvoice と、請求書作成前のプレビュー(getInvoicePreviewForWorker)で同じ条件を使うため共通化。
 * - 発注者の締め日に基づく請求期間に完了(CLOSED)した、受注者⇄発注者ペアの確定発注
 * - 注文書(ORDER_SHEET)があるもののみ
 * - 出来高を確定済みの発注書は除外（出来高側で申請月ごとに請求する）
 * - すでに非VOIDの請求書に含まれている発注は除外（excludeInvoiceIds = 再集計中の自分自身）
 */
export async function getBillableOrdersForInvoice(
  workerCompanyId: string,
  orderCompanyId: string,
  yearMonth: string, // YYYYMM
  excludeInvoiceIds: string[] = [],
) {
  // 発注者の締め日に基づく請求期間で集計（締め日 null は月末締め）
  const orderCompanyForPeriod = await prisma.company.findUnique({
    where: { id: orderCompanyId },
    select: { billingClosingDay: true },
  });
  const { start: startOfMonth, end: endOfMonth } = getBillingPeriod(
    yearMonth,
    orderCompanyForPeriod?.billingClosingDay ?? null
  );

  // 対象期間に締切(CLOSED)された発注を集計し、各発注の注文書(ORDER_SHEET)金額を請求対象とする
  const orders = await prisma.factoryFloorOrder.findMany({
    where: {
      deletedAt: null,
      status: "CONFIRMED",
      completionStatus: "CLOSED",
      workCompanyId: workerCompanyId,
      factoryFloor: { companyId: orderCompanyId, deletedAt: null },
      completedDay: { gte: startOfMonth, lte: endOfMonth },
      progressBillings: { none: { status: "CONFIRMED" } },
    },
    select: {
      id: true,
      completedDay: true,
      factoryFloorId: true,
      factoryFloor: { select: { name: true, code: true, parent: { select: { code: true, name: true } } } },
      documents: {
        where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
        select: {
          id: true,
          documentNumber: true,
          subtotal: true,
          taxAmount: true,
          totalAmount: true,
          metadata: true,
        },
      },
    },
    orderBy: { completedDay: "asc" },
  });

  // 注文書(ORDER_SHEET)が無い発注は請求対象外
  const ordersWithSheet = orders.filter((o) => o.documents.length > 0);

  // 二重請求ガード: すでに非VOIDの請求書に含まれている発注は除外する。
  // excludeInvoiceIds = 再集計中の自分自身(まだ非VOID)は除外対象から外す。
  const invoicedOrderIds = await getInvoicedOrderIds({
    workerCompanyId,
    orderCompanyId,
    excludeInvoiceIds,
  });
  return ordersWithSheet.filter((o) => !invoicedOrderIds.has(o.id));
}

/**
 * 月次請求書に合算する出来高（確定済み・請求月=yearMonth・未請求）を抽出する。
 * 請求月は申請月で決まる（確定日ではない）。確定待ち・差し戻しは含めない。
 */
export async function getBillableProgressForInvoice(
  workerCompanyId: string,
  orderCompanyId: string,
  yearMonth: string, // YYYYMM
  excludeInvoiceIds: string[] = [],
) {
  const items = await prisma.progressBilling.findMany({
    where: {
      status: "CONFIRMED",
      billingMonth: yearMonth,
      factoryFloorOrder: {
        deletedAt: null,
        workCompanyId: workerCompanyId,
        factoryFloor: { companyId: orderCompanyId, deletedAt: null },
      },
    },
    select: progressRowSelect,
    orderBy: { appliedAt: "asc" },
  });
  const invoiced = await getInvoicedProgressIds({ workerCompanyId, orderCompanyId, excludeInvoiceIds });
  return items.filter((p) => !invoiced.has(p.id));
}

/** その月に合算する明細（発注書＋出来高）。プレビューと生成で同じ結果になる */
export async function getBillableRowsForInvoice(
  workerCompanyId: string,
  orderCompanyId: string,
  yearMonth: string,
  excludeInvoiceIds: string[] = [],
): Promise<InvoiceRow[]> {
  const [orders, progress] = await Promise.all([
    getBillableOrdersForInvoice(workerCompanyId, orderCompanyId, yearMonth, excludeInvoiceIds),
    getBillableProgressForInvoice(workerCompanyId, orderCompanyId, yearMonth, excludeInvoiceIds),
  ]);
  return sortRows([...orders.map(orderRow), ...progress.map(progressRow)]);
}

function sortRows(rows: InvoiceRow[]): InvoiceRow[] {
  return rows.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
}

/** 明細から請求書(PDF＋Document)を作成する。generateInvoice / generateInvoiceFromOrders 共通 */
async function createInvoiceDocument(params: {
  rows: InvoiceRow[];
  workerCompanyId: string;
  orderCompanyId: string;
  yearMonth: string;
  issuedAtFallback: Date;
}): Promise<string> {
  const { rows, workerCompanyId, orderCompanyId, yearMonth } = params;

  const documentNumber = await generateDocumentNumber("INVOICE", yearMonth);

  // 合算: 発注書は注文書金額、出来高は確定金額(税抜)＋消費税
  const totalSubtotal = BigInt(rows.reduce((s, r) => s + r.subtotal, 0));
  const totalTax = BigInt(rows.reduce((s, r) => s + r.taxAmount, 0));
  const totalTotal = BigInt(rows.reduce((s, r) => s + r.totalAmount, 0));

  const [workerCompany, orderCompany] = await Promise.all([
    prisma.company.findUnique({ where: { id: workerCompanyId } }),
    prisma.company.findUnique({ where: { id: orderCompanyId } }),
  ]);

  const issuedAt = latestCompletedDay(
    rows.map((r) => ({ completedDay: r.date })),
    params.issuedAtFallback
  );

  const lineItems = rows.map((r) => ({
    documentNumber: r.documentNumber,
    date: r.date,
    siteName: r.siteName,
    siteCode: r.siteCode,
    amount: r.subtotal,
  }));

  const pdfData: InvoicePdfData = {
    documentNumber,
    issuedAt,
    yearMonth,
    workerCompanyName: workerCompany?.name ?? "",
    workerCompanyPostalCode: workerCompany?.postalCode ?? "",
    workerCompanyAddress: buildAddress(workerCompany),
    workerCompanyInvoiceNumber: workerCompany?.invoiceNumber ?? "",
    workerCompanyTel: workerCompany?.telNumber ?? "",
    workerCompanyEmail: workerCompany?.email ?? "",
    orderCompanyName: orderCompany?.name ?? "",
    lineItems,
    subtotal: Number(totalSubtotal),
    taxAmount10: Number(totalTax),
    totalAmount: Number(totalTotal),
    bankName: workerCompany?.bankName ?? "",
    bankBranchName: workerCompany?.bankBranchName ?? "",
    bankAccountType: workerCompany?.bankAccountType === "CURRENT" ? "当座" : "普通",
    bankAccountNumber: workerCompany?.bankAccountNumber ?? "",
    bankAccountName: workerCompany?.bankAccountName ?? "",
    stampImageBase64: loadStampImageBase64(workerCompany?.stampImage),
  };

  // PDF生成 → ファイル保存
  const pdfDataUrl = generateInvoicePdf(pdfData);
  const pdfFilePath = savePdfToFile(pdfDataUrl, documentNumber);

  const orderIds = [...new Set(rows.filter((r) => r.type === "ORDER").map((r) => r.orderId))];
  const progressBillingIds = rows
    .filter((r) => r.type === "PROGRESS")
    .map((r) => r.progressBillingId as string);

  const document = await prisma.document.create({
    data: {
      type: "INVOICE",
      status: "ISSUED",
      documentNumber,
      factoryFloorOrderId: rows[0].orderId, // 代表の発注ID
      orderCompanyId,
      workerCompanyId,
      subtotal: totalSubtotal,
      taxAmount: totalTax,
      totalAmount: totalTotal,
      invoiceNumber: workerCompany?.invoiceNumber,
      pdfUrl: pdfFilePath,
      issuedAt,
      yearMonth,
      metadata: {
        // orderIds = 注文書金額で請求した発注 / progressBillingIds = 出来高で請求した分（二重請求ガードの基準）
        orderIds,
        progressBillingIds,
        lineItems: rows.map((r) => ({
          documentNumber: r.documentNumber,
          siteName: r.siteName,
          siteCode: r.siteCode,
          amount: r.subtotal,
          ...(r.type === "PROGRESS"
            ? { progressBillingId: r.progressBillingId, billingMonth: r.billingMonth, progressKind: r.progressKind }
            : {}),
        })),
      },
    },
  });

  return document.id;
}

/**
 * 請求書を自動生成（月次締め処理）
 */
export async function generateInvoice(
  workerCompanyId: string,
  orderCompanyId: string,
  yearMonth: string, // YYYYMM
  excludeInvoiceIds: string[] = [], // 二重請求ガードから外す請求書ID(再集計中の自分自身)
): Promise<string> {
  const rows = await getBillableRowsForInvoice(workerCompanyId, orderCompanyId, yearMonth, excludeInvoiceIds);

  if (rows.length === 0) {
    throw new Error("対象月に請求対象の工事がありません");
  }

  return createInvoiceDocument({
    rows,
    workerCompanyId,
    orderCompanyId,
    yearMonth,
    issuedAtFallback: new Date(),
  });
}

/**
 * 指定された発注ID・出来高IDから請求書を生成（手動作成・作り直し用）
 * 発注は注文書(ORDER_SHEET)金額を、出来高は確定金額を合算する。
 */
export async function generateInvoiceFromOrders(
  orderIds: string[],
  billingDate: Date, // 完了日が取れない場合の発行日・請求月のフォールバック
  excludeInvoiceIds: string[] = [], // 二重請求ガードから外す請求書ID(作り直し中の自分自身)
  progressBillingIds: string[] = [],
): Promise<string> {
  const orders = orderIds.length
    ? await prisma.factoryFloorOrder.findMany({
        where: {
          id: { in: orderIds },
          deletedAt: null,
          completionStatus: "CLOSED",
          // 出来高を確定済みの発注書は注文書金額で重複請求しない
          progressBillings: { none: { status: "CONFIRMED" } },
        },
        select: {
          id: true,
          completedDay: true,
          workCompanyId: true,
          factoryFloorId: true,
          factoryFloor: {
            select: { companyId: true, name: true, code: true, parent: { select: { code: true, name: true } } },
          },
          documents: {
            where: { type: "ORDER_SHEET", status: { not: "VOID" }, deletedAt: null },
            select: {
              id: true,
              documentNumber: true,
              subtotal: true,
              taxAmount: true,
              totalAmount: true,
              metadata: true,
            },
          },
        },
      })
    : [];
  const progress = progressBillingIds.length
    ? await prisma.progressBilling.findMany({
        where: { id: { in: progressBillingIds }, status: "CONFIRMED", factoryFloorOrder: { deletedAt: null } },
        select: progressRowSelect,
      })
    : [];

  // 注文書(ORDER_SHEET)が無い発注は請求対象外
  const ordersWithSheet = orders.filter((o) => o.documents.length > 0);

  if (ordersWithSheet.length === 0 && progress.length === 0) {
    throw new Error("請求対象の工事がありません");
  }

  // 全て同一の (workerCompanyId, orderCompanyId) であることを検証
  const pairs = [
    ...ordersWithSheet.map((o) => `${o.workCompanyId}::${o.factoryFloor.companyId}`),
    ...progress.map((p) => `${p.factoryFloorOrder.workCompanyId}::${p.factoryFloorOrder.factoryFloor.companyId}`),
  ];
  if (new Set(pairs).size !== 1) {
    throw new Error("異なる取引先の工事が混在しています");
  }
  const [workerCompanyId, orderCompanyId] = pairs[0].split("::");

  // 二重請求ガード: すでに非VOIDの請求書に含まれている発注・出来高は除外する。
  // excludeInvoiceIds = 作り直し中の自分自身(まだ非VOID)は除外対象から外す。
  const [invoicedOrderIds, invoicedProgressIds] = await Promise.all([
    getInvoicedOrderIds({ workerCompanyId, orderCompanyId, excludeInvoiceIds }),
    getInvoicedProgressIds({ workerCompanyId, orderCompanyId, excludeInvoiceIds }),
  ]);
  const billableOrders = ordersWithSheet.filter((o) => !invoicedOrderIds.has(o.id));
  const billableProgress = progress.filter((p) => !invoicedProgressIds.has(p.id));

  if (billableOrders.length === 0 && billableProgress.length === 0) {
    throw new Error("選択した工事はすべて請求済みです");
  }

  // 請求月は「発行日」ではなく工事の締め月（完了日＋発注者の締め日）／出来高の申請月で決める。
  // 締め月が混在する場合は最新を採用。
  const ordererClosing = await prisma.company.findUnique({
    where: { id: orderCompanyId },
    select: { billingClosingDay: true },
  });
  const billingMonths = [
    ...billableOrders.map((o) =>
      o.completedDay ? getBillingMonth(o.completedDay, ordererClosing?.billingClosingDay ?? null) : null
    ),
    ...billableProgress.map((p) => p.billingMonth),
  ]
    .filter((m): m is string => m !== null)
    .sort();
  const yearMonth =
    billingMonths.length > 0
      ? billingMonths[billingMonths.length - 1]
      : `${billingDate.getFullYear()}${String(billingDate.getMonth() + 1).padStart(2, "0")}`;

  return createInvoiceDocument({
    rows: sortRows([...billableOrders.map(orderRow), ...billableProgress.map(progressRow)]),
    workerCompanyId,
    orderCompanyId,
    yearMonth,
    issuedAtFallback: billingDate,
  });
}
