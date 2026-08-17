import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { generateOrderSheetPdf, type OrderSheetPdfData } from "./order-sheet-pdf";
import { generateInvoicePdf, type InvoicePdfData } from "./invoice-pdf";
import { getBillingPeriod, getBillingMonth } from "@/lib/helpers/billing-period";
import { getInvoicedOrderIds } from "@/lib/helpers/invoiced-orders";

/**
 * 帳票番号の自動採番
 * FORMAT: {TYPE_PREFIX}-{YYYYMM}-{SEQ}
 */
async function generateDocumentNumber(
  type: "ORDER_SHEET" | "DELIVERY_NOTE" | "INVOICE",
  yearMonthOverride?: string,
): Promise<string> {
  const prefix = {
    ORDER_SHEET: "ORD",
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
  let subtotal: bigint;

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

    const detailsTotal = additionalData.priceDetails.reduce(
      (sum, p) => sum + Math.ceil(p.quantity * p.priceUnit), 0
    );
    subtotal = BigInt(detailsTotal);
  } else {
    // 通常注文: floor.priceDetails を使用
    pdfPriceDetails = floor.priceDetails.map((p) => ({
      name: p.name ?? "",
      specifications: p.specifications ?? "",
      quantity: p.quantity ?? 0,
      unit: p.unit?.name ?? "",
      priceUnit: Number(p.priceUnit ?? 0),
    }));

    const priceDetailsTotal = floor.priceDetails.reduce(
      (sum, p) => sum + Math.ceil((p.quantity ?? 0) * Number(p.priceUnit ?? 0)),
      0
    );
    subtotal = priceDetailsTotal > 0 ? BigInt(priceDetailsTotal) : (floor.totalAmount ?? BigInt(0));
  }

  const taxRate = 0.10;
  const taxAmount = BigInt(Math.ceil(Number(subtotal) * taxRate));
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
          quantity: p.quantity,
          unit: p.unit,
          priceUnit: p.priceUnit,
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
    },
    select: {
      id: true,
      completedDay: true,
      factoryFloorId: true,
      factoryFloor: { select: { name: true, code: true, parent: { select: { code: true } } } },
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
  const billableOrders = ordersWithSheet.filter((o) => !invoicedOrderIds.has(o.id));

  if (billableOrders.length === 0) {
    throw new Error("対象月に請求対象の工事がありません");
  }

  const documentNumber = await generateDocumentNumber("INVOICE", yearMonth);

  // 合算: 各発注の非VOIDの注文書金額をそのまま合計
  let totalSubtotal = BigInt(0);
  let totalTax = BigInt(0);
  let totalTotal = BigInt(0);

  for (const order of billableOrders) {
    for (const sheet of order.documents) {
      totalSubtotal += sheet.subtotal ?? BigInt(0);
      totalTax += sheet.taxAmount ?? BigInt(0);
      totalTotal += sheet.totalAmount ?? BigInt(0);
    }
  }

  const workerCompany = await prisma.company.findUnique({
    where: { id: workerCompanyId },
  });

  const orderCompany = await prisma.company.findUnique({
    where: { id: orderCompanyId },
  });

  const issuedAt = new Date();

  // PDF生成データ: 各発注の注文書を明細行に
  const lineItems = billableOrders.map((order) => {
    const sheet = order.documents[0];
    return {
      documentNumber: sheet?.documentNumber ?? "",
      date: order.completedDay,
      siteName:
        order.factoryFloor.name ??
        ((sheet?.metadata as Record<string, unknown> | null)?.siteName as string) ??
        "",
      siteCode: order.factoryFloor.code ?? order.factoryFloor.parent?.code ?? "",
      amount: order.documents.reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0),
    };
  });

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

  const document = await prisma.document.create({
    data: {
      type: "INVOICE",
      status: "ISSUED",
      documentNumber,
      factoryFloorOrderId: billableOrders[0].id, // 代表の発注ID
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
        orderIds: billableOrders.map((o) => o.id),
        lineItems: billableOrders.map((order) => {
          const sheet = order.documents[0];
          return {
            documentNumber: sheet?.documentNumber ?? "",
            siteName:
              order.factoryFloor.name ??
              ((sheet?.metadata as Record<string, unknown> | null)?.siteName as string) ??
              "",
            siteCode: order.factoryFloor.code ?? order.factoryFloor.parent?.code ?? "",
            amount: order.documents.reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0),
          };
        }),
      },
    },
  });

  return document.id;
}

/**
 * 指定された発注IDから請求書を生成（手動作成用）
 * 各発注の注文書(ORDER_SHEET)金額をそのまま合算する。
 */
export async function generateInvoiceFromOrders(
  orderIds: string[],
  billingDate: Date,
  excludeInvoiceIds: string[] = [], // 二重請求ガードから外す請求書ID(作り直し中の自分自身)
): Promise<string> {
  const orders = await prisma.factoryFloorOrder.findMany({
    where: {
      id: { in: orderIds },
      deletedAt: null,
      completionStatus: "CLOSED",
    },
    select: {
      id: true,
      completedDay: true,
      workCompanyId: true,
      factoryFloorId: true,
      factoryFloor: { select: { companyId: true, name: true, code: true, parent: { select: { code: true } } } },
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
  });

  // 注文書(ORDER_SHEET)が無い発注は請求対象外
  const ordersWithSheet = orders.filter((o) => o.documents.length > 0);

  if (ordersWithSheet.length === 0) {
    throw new Error("請求対象の工事がありません");
  }

  // 全て同一の (workerCompanyId, orderCompanyId) であることを検証
  const workerCompanyId = ordersWithSheet[0].workCompanyId;
  const orderCompanyId = ordersWithSheet[0].factoryFloor.companyId;
  for (const order of ordersWithSheet) {
    if (order.workCompanyId !== workerCompanyId || order.factoryFloor.companyId !== orderCompanyId) {
      throw new Error("異なる取引先の工事が混在しています");
    }
  }

  // 二重請求ガード: すでに非VOIDの請求書に含まれている発注は除外する。
  // excludeInvoiceIds = 作り直し中の自分自身(まだ非VOID)は除外対象から外す。
  const invoicedOrderIds = await getInvoicedOrderIds({
    workerCompanyId,
    orderCompanyId,
    excludeInvoiceIds,
  });
  const billableOrders = ordersWithSheet.filter((o) => !invoicedOrderIds.has(o.id));

  if (billableOrders.length === 0) {
    throw new Error("選択した工事はすべて請求済みです");
  }

  // 請求月は「発行日」ではなく工事の締め月（完了日＋発注者の締め日）で決める。
  // 候補一覧・納品書一覧(getBillingMonth)と同じ基準に揃える。締め月が混在する場合は最新を採用。
  const ordererClosing = await prisma.company.findUnique({
    where: { id: orderCompanyId },
    select: { billingClosingDay: true },
  });
  const billingMonths = billableOrders
    .map((o) =>
      o.completedDay ? getBillingMonth(o.completedDay, ordererClosing?.billingClosingDay ?? null) : null
    )
    .filter((m): m is string => m !== null)
    .sort();
  const yearMonth =
    billingMonths.length > 0
      ? billingMonths[billingMonths.length - 1]
      : `${billingDate.getFullYear()}${String(billingDate.getMonth() + 1).padStart(2, "0")}`;

  const documentNumber = await generateDocumentNumber("INVOICE", yearMonth);

  let totalSubtotal = BigInt(0);
  let totalTax = BigInt(0);
  let totalTotal = BigInt(0);

  for (const order of billableOrders) {
    for (const sheet of order.documents) {
      totalSubtotal += sheet.subtotal ?? BigInt(0);
      totalTax += sheet.taxAmount ?? BigInt(0);
      totalTotal += sheet.totalAmount ?? BigInt(0);
    }
  }

  const workerCompany = await prisma.company.findUnique({
    where: { id: workerCompanyId },
  });

  const orderCompany = await prisma.company.findUnique({
    where: { id: orderCompanyId },
  });

  const lineItems = billableOrders.map((order) => {
    const sheet = order.documents[0];
    return {
      documentNumber: sheet?.documentNumber ?? "",
      date: order.completedDay,
      siteName:
        order.factoryFloor.name ??
        ((sheet?.metadata as Record<string, unknown> | null)?.siteName as string) ??
        "",
      siteCode: order.factoryFloor.code ?? order.factoryFloor.parent?.code ?? "",
      amount: order.documents.reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0),
    };
  });

  const pdfData: InvoicePdfData = {
    documentNumber,
    issuedAt: billingDate,
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

  const pdfDataUrl = generateInvoicePdf(pdfData);
  const pdfFilePath = savePdfToFile(pdfDataUrl, documentNumber);

  const doc = await prisma.document.create({
    data: {
      type: "INVOICE",
      status: "ISSUED",
      documentNumber,
      factoryFloorOrderId: billableOrders[0].id,
      orderCompanyId,
      workerCompanyId,
      subtotal: totalSubtotal,
      taxAmount: totalTax,
      totalAmount: totalTotal,
      invoiceNumber: workerCompany?.invoiceNumber,
      pdfUrl: pdfFilePath,
      issuedAt: billingDate,
      yearMonth,
      metadata: {
        orderIds: billableOrders.map((o) => o.id),
        lineItems: billableOrders.map((order) => {
          const sheet = order.documents[0];
          return {
            documentNumber: sheet?.documentNumber ?? "",
            siteName:
              order.factoryFloor.name ??
              ((sheet?.metadata as Record<string, unknown> | null)?.siteName as string) ??
              "",
            siteCode: order.factoryFloor.code ?? order.factoryFloor.parent?.code ?? "",
            amount: order.documents.reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0),
          };
        }),
      },
    },
  });

  return doc.id;
}
