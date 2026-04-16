import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { setupFont, yenFmt, dateJP, ML, MR, RE, CW } from "./pdf-utils";

function dateSlash(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// ============ Types ============
export interface InvoicePdfData {
  documentNumber: string;
  issuedAt: Date;
  yearMonth: string; // YYYYMM
  /** 発行者（右側）= 受注者 */
  workerCompanyName: string;
  workerCompanyPostalCode: string;
  workerCompanyAddress: string;
  workerCompanyInvoiceNumber: string;
  workerCompanyTel: string;
  workerCompanyEmail: string;
  /** 受取人 = 発注者 */
  orderCompanyName: string;
  /** 納品書ごとの明細行 */
  lineItems: {
    documentNumber: string;
    date: string | Date | null;
    siteName: string;
    amount: number;
  }[];
  subtotal: number;
  taxAmount10: number;
  totalAmount: number;
  paymentDueDate?: string;
  /** 振込先 */
  bankName: string;
  bankBranchName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankAccountName: string;
  stampImageBase64?: string;
}

// 5 columns: No. | 日付 | 工事名 | 金額 | 税率
const COL_W = [13, 25, 72, 35, 20]; // total = 165

// ============ Drawing functions ============

/**
 * タイトル「請 求 書」— 中央・太字・下線
 */
function drawTitle(doc: jsPDF): number {
  doc.setFontSize(24);
  doc.setFont("NotoSansJP", "bold");
  const title = "請 求 書";
  doc.text(title, 105, 28, { align: "center" });

  const tw = doc.getTextWidth(title);
  doc.setLineWidth(0.8);
  doc.line(105 - tw / 2, 31, 105 + tw / 2, 31);

  doc.setFont("NotoSansJP", "normal");
  return 42;
}

/**
 * 宛先（左）+ 請求番号・発行日（右）
 */
function drawRecipientAndDocInfo(doc: jsPDF, data: InvoicePdfData, startY: number): number {
  let y = startY;

  // ── 左側: 宛先（発注者） ──
  doc.setFontSize(14);
  doc.setFont("NotoSansJP", "bold");
  doc.text(`${data.orderCompanyName} 御中`, ML, y);
  doc.setFont("NotoSansJP", "normal");

  y += 10;
  doc.setFontSize(9.5);

  // 対象年月
  const ym = data.yearMonth;
  const yearStr = ym.substring(0, 4);
  const monthStr = ym.substring(4, 6);
  doc.text(`${yearStr}年${parseInt(monthStr)}月分 御請求`, ML, y);

  y += 7;
  doc.text("下記の通り御請求申し上げます。", ML, y);

  // ── 右側: 請求番号・発行日 ──
  doc.setFontSize(9.5);
  doc.text(`請求番号: ${data.documentNumber}`, RE, startY, { align: "right" });
  doc.text(`発行日: ${dateJP(data.issuedAt)}`, RE, startY + 6, { align: "right" });

  return y + 8;
}

/**
 * 発行者情報（受注者）— 右寄せブロック
 */
function drawIssuerBlock(doc: jsPDF, data: InvoicePdfData, startY: number): void {
  const blockX = 130;
  let y = startY;

  doc.setFontSize(12);
  doc.setFont("NotoSansJP", "bold");
  doc.text(data.workerCompanyName, blockX, y);
  doc.setFont("NotoSansJP", "normal");

  y += 7;
  doc.setFontSize(9.5);

  if (data.workerCompanyPostalCode) {
    doc.text(`〒${data.workerCompanyPostalCode}`, blockX, y);
    y += 5.5;
  }
  if (data.workerCompanyAddress) {
    doc.text(data.workerCompanyAddress, blockX, y);
    y += 5.5;
  }
  if (data.workerCompanyInvoiceNumber) {
    doc.text(`登録番号: ${data.workerCompanyInvoiceNumber}`, blockX, y);
    y += 5.5;
  }
  if (data.workerCompanyTel) {
    doc.text(`TEL: ${data.workerCompanyTel}`, blockX, y);
    y += 5.5;
  }
  if (data.workerCompanyEmail) {
    doc.text(`Email: ${data.workerCompanyEmail}`, blockX, y);
  }

  // 印鑑 — PNG画像がある場合のみ表示
  if (data.stampImageBase64) {
    const stampSize = 18;
    doc.addImage(data.stampImageBase64, "PNG", RE - stampSize - 1, startY + 3, stampSize, stampSize);
  }
}

/**
 * ご請求金額ボックス
 */
function drawAmountBox(doc: jsPDF, data: InvoicePdfData, y: number): number {
  const boxW = 145;
  const boxH = 22;
  const boxX = (210 - boxW) / 2;

  doc.setLineWidth(0.5);
  doc.rect(boxX, y, boxW, boxH);

  doc.setFontSize(18);
  doc.setFont("NotoSansJP", "bold");
  doc.text(
    `ご請求金額: ${yenFmt(data.totalAmount)}（税込）`,
    105,
    y + boxH / 2 + 3,
    { align: "center" }
  );
  doc.setFont("NotoSansJP", "normal");

  return y + boxH + 10;
}

/**
 * 振込先情報
 */
function drawBankInfo(doc: jsPDF, data: InvoicePdfData, y: number): number {
  doc.setFontSize(10.5);
  doc.setFont("NotoSansJP", "bold");
  doc.text("【振込先】", ML, y);
  doc.setFont("NotoSansJP", "normal");

  y += 7;
  doc.setFontSize(9.5);

  const infoItems: string[] = [];
  if (data.bankName) infoItems.push(`銀行名: ${data.bankName}`);
  if (data.bankBranchName) infoItems.push(`支店名: ${data.bankBranchName}`);
  if (data.bankAccountType) infoItems.push(`口座種別: ${data.bankAccountType}`);
  if (data.bankAccountNumber) infoItems.push(`口座番号: ${data.bankAccountNumber}`);
  if (data.bankAccountName) infoItems.push(`口座名義: ${data.bankAccountName}`);

  for (const info of infoItems) {
    doc.text(info, ML + 5, y);
    y += 5.5;
  }

  if (data.paymentDueDate) {
    y += 2;
    doc.setFont("NotoSansJP", "bold");
    doc.text(`お支払期限: ${data.paymentDueDate}`, ML, y);
    doc.setFont("NotoSansJP", "normal");
    y += 7;
  }

  return y + 4;
}

/**
 * 明細テーブル
 */
function drawLineItemsTable(doc: jsPDF, data: InvoicePdfData, y: number): number {
  const bodyRows = data.lineItems.map((item, i) => [
    String(i + 1),
    dateSlash(item.date),
    item.siteName,
    yenFmt(item.amount),
    "10%",
  ]);

  // 最低1行は確保（データが0件の場合）
  if (bodyRows.length === 0) {
    bodyRows.push(["", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    head: [["No.", "日付", "工事名", "金額", "税率"]],
    body: bodyRows,
    theme: "grid",
    styles: {
      font: "NotoSansJP",
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
      lineWidth: 0.3,
      lineColor: [50, 50, 50],
      textColor: [20, 20, 20],
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: [45, 45, 45],
      textColor: [255, 255, 255],
      fontSize: 8,
      halign: "center",
      font: "NotoSansJP",
      fontStyle: "bold",
      cellPadding: { top: 3.5, bottom: 3.5, left: 2.5, right: 2.5 },
    },
    columnStyles: {
      0: { cellWidth: COL_W[0], halign: "center" },
      1: { cellWidth: COL_W[1], halign: "center" },
      2: { cellWidth: COL_W[2] },
      3: { cellWidth: COL_W[3], halign: "right" },
      4: { cellWidth: COL_W[4], halign: "center" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY: number = (doc as any).lastAutoTable?.finalY ?? y + 100;
  return finalY;
}

/**
 * 集計行（小計・消費税・合計）
 */
function drawSummaryRows(doc: jsPDF, data: InvoicePdfData, y: number): number {
  // 金額列と税率列の幅を使う
  const labelX = ML + COL_W[0] + COL_W[1] + COL_W[2]; // No.+日付+工事名の後
  const labelW = COL_W[3]; // 金額列幅
  const amountX = labelX + labelW;
  const amountW = COL_W[4]; // 税率列幅
  const rowH = 9;

  y += 2;

  const rows = [
    { label: "小計", amount: yenFmt(data.subtotal), bold: false },
    { label: "消費税（10%）", amount: yenFmt(data.taxAmount10), bold: false },
    { label: "合計", amount: yenFmt(data.totalAmount), bold: true },
  ];

  doc.setLineWidth(0.3);
  doc.setDrawColor(50, 50, 50);

  rows.forEach((row, i) => {
    const ry = y + i * rowH;

    doc.rect(labelX, ry, labelW, rowH);
    doc.rect(amountX, ry, amountW, rowH);

    doc.setFontSize(9);
    doc.setFont("NotoSansJP", row.bold ? "bold" : "normal");
    doc.text(row.label, labelX + 4, ry + rowH / 2 + 1.2);

    doc.setFontSize(row.bold ? 10 : 9);
    doc.text(row.amount, amountX + amountW - 4, ry + rowH / 2 + 1.2, { align: "right" });
  });

  doc.setFont("NotoSansJP", "normal");
  doc.setDrawColor(0, 0, 0);

  return y + rows.length * rowH + 12;
}

// ============ Main export ============

export function generateInvoicePdf(data: InvoicePdfData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFont(doc);

  let y = drawTitle(doc);
  y = drawRecipientAndDocInfo(doc, data, y);

  // 右側に発行者情報を描画（左側と並列）
  drawIssuerBlock(doc, data, y);
  y += 32; // 発行者ブロック分のスペース

  y = drawAmountBox(doc, data, y);
  y = drawBankInfo(doc, data, y);
  y = drawLineItemsTable(doc, data, y);
  drawSummaryRows(doc, data, y);

  return doc.output("datauristring");
}
