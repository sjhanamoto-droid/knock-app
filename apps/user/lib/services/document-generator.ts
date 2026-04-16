import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { generateOrderSheetPdf, type OrderSheetPdfData } from "./order-sheet-pdf";
import { generateDeliveryNotePdf, type DeliveryNotePdfData } from "./delivery-note-pdf";
import { generateInvoicePdf, type InvoicePdfData } from "./invoice-pdf";

/**
 * 帳票番号の自動採番
 * FORMAT: {TYPE_PREFIX}-{YYYYMM}-{SEQ}
 */
async function generateDocumentNumber(type: "ORDER_SHEET" | "DELIVERY_NOTE" | "INVOICE"): Promise<string> {
  const prefix = {
    ORDER_SHEET: "ORD",
    DELIVERY_NOTE: "DLV",
    INVOICE: "INV",
  }[type];

  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

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
 * PDFデータURIをファイルに保存し、相対パスを返す
 */
export function savePdfToFile(pdfDataUri: string, documentNumber: string): string {
  const uploadsDir = path.join(process.cwd(), "public/uploads/documents");

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const base64Data = pdfDataUri.replace(/^data:application\/pdf;[^,]*,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  const fileName = `${documentNumber}.pdf`;
  const filePath = path.join(uploadsDir, fileName);

  fs.writeFileSync(filePath, buffer);

  return `/uploads/documents/${fileName}`;
}

/**
 * 印鑑画像URLからbase64文字列を読み込む
 */
function loadStampImageBase64(stampImageUrl: string | null | undefined): string | undefined {
  if (!stampImageUrl) return undefined;
  try {
    // /uploads/xxx.png → public/uploads/xxx.png
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
 * 注文書を自動生成（発注確定時にトリガー）
 */
export async function generateOrderSheet(orderId: string): Promise<string> {
  const order = await prisma.factoryFloorOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      factoryFloor: {
        include: {
          company: true,
          workCompany: true,
          priceDetails: { where: { deletedAt: null }, include: { unit: true } },
        },
      },
    },
  });

  const floor = order.factoryFloor;
  const documentNumber = await generateDocumentNumber("ORDER_SHEET");
  const issuedAt = new Date();

  // 金額計算（明細を優先）
  const priceDetailsTotal = floor.priceDetails.reduce(
    (sum, p) => sum + Math.ceil((p.quantity ?? 0) * Number(p.priceUnit ?? 0)),
    0
  );
  const subtotal = priceDetailsTotal > 0 ? BigInt(priceDetailsTotal) : (floor.totalAmount ?? BigInt(0));
  const taxRate = 0.10;
  const taxAmount = BigInt(Math.ceil(Number(subtotal) * taxRate));
  const totalAmount = subtotal + taxAmount;

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
    siteName: floor.name ?? "",
    deliveryDate: floor.endDayRequest,
    // 明細
    priceDetails: floor.priceDetails.map((p) => ({
      name: p.name ?? "",
      specifications: p.specifications ?? "",
      quantity: p.quantity ?? 0,
      unit: p.unit?.name ?? "",
      priceUnit: Number(p.priceUnit ?? 0),
    })),
    subtotal: Number(subtotal),
    taxAmount10: Number(taxAmount),
    totalAmount: Number(totalAmount),
    remarks: floor.remarks ?? "",
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
        siteName: floor.name,
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
      },
    },
  });

  return document.id;
}

/**
 * 納品書を自動生成（納品承認時にトリガー）
 */
export async function generateDeliveryNote(orderId: string): Promise<string> {
  const order = await prisma.factoryFloorOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      factoryFloor: {
        include: {
          company: true,
          workCompany: true,
          priceDetails: { where: { deletedAt: null }, include: { unit: true } },
        },
      },
      completionReport: true,
    },
  });

  const floor = order.factoryFloor;
  const documentNumber = await generateDocumentNumber("DELIVERY_NOTE");
  const issuedAt = new Date();

  // inspectionData から追加工事・諸経費・調整金額・前払金・備考を取得
  type InspectionData = {
    additionalItems?: { name: string; quantity: number; unitId: string; priceUnit: number; specifications: string }[];
    expenses?: number;
    adjustmentAmount?: number;
    advancePayment?: number;
    memo?: string;
  };
  const inspectionData = (order.inspectionData as InspectionData | null) ?? {};

  // 追加工事の単位名を解決
  let pdfAdditionalItems: DeliveryNotePdfData["additionalItems"];
  const additionalTotal = inspectionData.additionalItems?.reduce(
    (sum, item) => sum + Math.ceil(item.quantity * item.priceUnit), 0
  ) ?? 0;

  if (inspectionData.additionalItems?.length) {
    const unitIds = inspectionData.additionalItems.map((i) => i.unitId).filter(Boolean);
    const units = unitIds.length > 0
      ? await prisma.unit.findMany({ where: { id: { in: unitIds } } })
      : [];
    const unitMap = new Map(units.map((u) => [u.id, u.name]));

    pdfAdditionalItems = inspectionData.additionalItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unitId ? (unitMap.get(item.unitId) ?? "") : "",
      priceUnit: item.priceUnit,
      specifications: item.specifications ?? "",
    }));
  }

  const expenses = inspectionData.expenses ?? 0;
  const adjustmentAmount = inspectionData.adjustmentAmount ?? 0;
  const advancePayment = inspectionData.advancePayment ?? 0;

  // 金額計算
  const priceDetailsTotal = floor.priceDetails.reduce(
    (sum, p) => sum + Math.ceil((p.quantity ?? 0) * Number(p.priceUnit ?? 0)),
    0
  );
  const baseSubtotal = priceDetailsTotal > 0 ? priceDetailsTotal : Number(floor.totalAmount ?? 0);
  const taxRate = 0.10;
  // 消費税は工事金額 + 追加工事に対して計算
  const allItemsSubtotal = baseSubtotal + additionalTotal;
  const taxAmount = Math.ceil(allItemsSubtotal * taxRate);
  // 合計 = 小計 + 追加工事 + 消費税 + 諸経費 + 調整金額
  const totalAmount = allItemsSubtotal + taxAmount + expenses + adjustmentAmount;
  // お支払金額 = 合計 - 前払金
  const paymentAmount = totalAmount - advancePayment;

  // PDF生成データ
  const pdfData: DeliveryNotePdfData = {
    documentNumber,
    issuedAt,
    workCompanyName: floor.workCompany?.name ?? "",
    workCompanyPostalCode: floor.workCompany?.postalCode ?? "",
    workCompanyAddress: buildAddress(floor.workCompany),
    workCompanyInvoiceNumber: floor.workCompany?.invoiceNumber ?? "",
    workCompanyTel: floor.workCompany?.telNumber ?? "",
    workCompanyEmail: floor.workCompany?.email ?? "",
    orderCompanyName: floor.company?.name ?? "",
    siteName: floor.name ?? "",
    siteAddress: floor.address ?? "",
    startDate: floor.startDayRequest,
    endDate: floor.endDayRequest,
    completionDate: order.completionReport?.completionDate ?? null,
    priceDetails: floor.priceDetails.map((p) => ({
      name: p.name ?? "",
      quantity: p.quantity ?? 0,
      unit: p.unit?.name ?? "",
      priceUnit: Number(p.priceUnit ?? 0),
    })),
    subtotal: baseSubtotal,
    taxAmount10: taxAmount,
    totalAmount,
    stampImageBase64: loadStampImageBase64(floor.workCompany?.stampImage),
    additionalItems: pdfAdditionalItems,
    expenses: expenses || undefined,
    adjustmentAmount: adjustmentAmount || undefined,
    advancePayment: advancePayment || undefined,
    memo: inspectionData.memo || undefined,
  };

  // PDF生成 → ファイル保存
  const pdfDataUrl = generateDeliveryNotePdf(pdfData);
  const pdfFilePath = savePdfToFile(pdfDataUrl, documentNumber);

  const document = await prisma.document.create({
    data: {
      type: "DELIVERY_NOTE",
      status: "ISSUED",
      documentNumber,
      factoryFloorOrderId: orderId,
      orderCompanyId: floor.companyId,
      workerCompanyId: floor.workCompanyId!,
      subtotal: BigInt(baseSubtotal),
      taxAmount: BigInt(taxAmount),
      totalAmount: BigInt(paymentAmount),
      invoiceNumber: floor.workCompany?.invoiceNumber,
      pdfUrl: pdfFilePath,
      issuedAt,
      metadata: {
        siteName: floor.name,
        completionDate: order.completionReport?.completionDate?.toISOString(),
        finalAmount: paymentAmount,
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
): Promise<string> {
  const year = parseInt(yearMonth.substring(0, 4));
  const month = parseInt(yearMonth.substring(4, 6));
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  // 対象月の納品承認済みの取引を集計
  const deliveryNotes = await prisma.document.findMany({
    where: {
      type: "DELIVERY_NOTE",
      status: { in: ["ISSUED", "CONFIRMED"] },
      workerCompanyId,
      orderCompanyId,
      issuedAt: { gte: startOfMonth, lte: endOfMonth },
      deletedAt: null,
    },
    include: {
      factoryFloorOrder: true,
    },
  });

  if (deliveryNotes.length === 0) {
    throw new Error("対象月に請求対象の納品書がありません");
  }

  const documentNumber = await generateDocumentNumber("INVOICE");

  // 合算
  let totalSubtotal = BigInt(0);
  let totalTax = BigInt(0);
  let totalTotal = BigInt(0);

  for (const note of deliveryNotes) {
    totalSubtotal += note.subtotal ?? BigInt(0);
    totalTax += note.taxAmount ?? BigInt(0);
    totalTotal += note.totalAmount ?? BigInt(0);
  }

  const workerCompany = await prisma.company.findUnique({
    where: { id: workerCompanyId },
  });

  const orderCompany = await prisma.company.findUnique({
    where: { id: orderCompanyId },
  });

  const issuedAt = new Date();

  // PDF生成データ
  const lineItems = deliveryNotes.map((n) => ({
    documentNumber: n.documentNumber ?? "",
    date: n.issuedAt,
    siteName: (n.metadata as Record<string, unknown> | null)?.siteName as string ?? "",
    amount: Number(n.totalAmount ?? 0),
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

  const document = await prisma.document.create({
    data: {
      type: "INVOICE",
      status: "ISSUED",
      documentNumber,
      factoryFloorOrderId: deliveryNotes[0].factoryFloorOrderId, // 代表の取引ID
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
        deliveryNoteIds: deliveryNotes.map((n) => n.id),
        lineItems: deliveryNotes.map((n) => ({
          documentNumber: n.documentNumber,
          siteName: (n.metadata as Record<string, unknown> | null)?.siteName ?? "",
          amount: Number(n.totalAmount),
        })),
      },
    },
  });

  return document.id;
}
