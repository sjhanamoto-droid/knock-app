import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { setupFont, yenFmt, dateJP, ML, MR, RE, CW } from "./pdf-utils";

// ============ Types ============
export interface OrderSheetPdfData {
  documentNumber: string;
  issuedAt: Date;
  // 受注者（宛先）
  workerCompanyName: string;
  workerCompanyAddress: string;
  workerCompanyTel: string;
  workerCompanyFax: string;
  contactPersonName: string;
  // 発注者（発行元）
  orderCompanyName: string;
  orderCompanyPostalCode: string;
  orderCompanyAddress: string;
  orderCompanyTel: string;
  orderCompanyRepresentative: string;
  // 現場情報
  siteName: string;
  deliveryDate: string | Date | null;
  // 明細
  priceDetails: {
    name: string;
    specifications: string;
    unit: string;
    quantity: number;
    priceUnit: number;
  }[];
  subtotal: number;
  taxAmount10: number;
  totalAmount: number;
  remarks: string;
  stampImageBase64?: string;
}

// 7 columns: No. | 項目 | 品番・規格 | 単位 | 数量 | 単価 | 金額
const COL_W = [13, 40, 32, 15, 15, 23, 27]; // total = 165

// ============ Drawing functions ============

/**
 * タイトル「注 文 書」+ 注文番号・発行日（右上ヘッダー）
 */
function drawTitleAndDocInfo(doc: jsPDF, data: OrderSheetPdfData): number {
  // タイトル中央
  doc.setFontSize(24);
  doc.setFont("NotoSansJP", "bold");
  const title = "注 文 書";
  doc.text(title, 105, 28, { align: "center" });

  // 下線（太め）
  const tw = doc.getTextWidth(title);
  doc.setLineWidth(0.8);
  doc.line(105 - tw / 2, 31, 105 + tw / 2, 31);

  // 右上: 注文番号・発行日
  doc.setFont("NotoSansJP", "normal");
  doc.setFontSize(9);
  doc.text(`注文番号: ${data.documentNumber}`, RE, 18, { align: "right" });
  doc.text(`発行日: ${dateJP(data.issuedAt)}`, RE, 24, { align: "right" });

  return 42;
}

/**
 * 宛先（左側）— 受注者情報
 */
function drawRecipient(doc: jsPDF, data: OrderSheetPdfData, startY: number): number {
  let y = startY;

  // 会社名 御中（太字・大きめ）
  doc.setFontSize(14);
  doc.setFont("NotoSansJP", "bold");
  doc.text(`${data.workerCompanyName} 御中`, ML, y);
  doc.setFont("NotoSansJP", "normal");

  y += 10;
  doc.setFontSize(9.5);

  if (data.workerCompanyAddress) {
    doc.text(data.workerCompanyAddress, ML, y);
    y += 5.5;
  }
  if (data.workerCompanyTel) {
    doc.text(`TEL: ${data.workerCompanyTel}`, ML, y);
    y += 5.5;
  }
  if (data.workerCompanyFax) {
    doc.text(`FAX: ${data.workerCompanyFax}`, ML, y);
    y += 5.5;
  }
  if (data.contactPersonName) {
    doc.text(`ご担当: ${data.contactPersonName} 様`, ML, y);
    y += 5.5;
  }

  return y;
}

/**
 * 発行元会社情報（右側）+ 印鑑 — 宛先と並列描画
 */
function drawIssuerBlock(doc: jsPDF, data: OrderSheetPdfData, startY: number): number {
  const blockX = 130;
  let y = startY;

  // 会社名（太字）
  doc.setFontSize(11);
  doc.setFont("NotoSansJP", "bold");
  doc.text(data.orderCompanyName, blockX, y);
  doc.setFont("NotoSansJP", "normal");

  y += 6;
  doc.setFontSize(8.5);

  if (data.orderCompanyPostalCode) {
    doc.text(`〒${data.orderCompanyPostalCode}`, blockX, y);
    y += 5;
  }
  if (data.orderCompanyAddress) {
    doc.text(data.orderCompanyAddress, blockX, y);
    y += 5;
  }
  if (data.orderCompanyTel) {
    doc.text(`TEL: ${data.orderCompanyTel}`, blockX, y);
    y += 5;
  }
  if (data.orderCompanyRepresentative) {
    doc.text(`代表: ${data.orderCompanyRepresentative}`, blockX, y);
    y += 5;
  }

  // 印鑑 — PNG画像がある場合のみ表示
  if (data.stampImageBase64) {
    const stampSize = 18;
    doc.addImage(data.stampImageBase64, "PNG", RE - stampSize - 1, startY + 3, stampSize, stampSize);
  }

  return y;
}

/**
 * 現場名・納品希望日
 */
function drawSiteInfo(doc: jsPDF, data: OrderSheetPdfData, y: number): number {
  doc.setFontSize(10.5);

  // 現場名
  doc.setFont("NotoSansJP", "bold");
  doc.text("現場名:", ML, y);
  doc.setFont("NotoSansJP", "normal");
  const siteNameX = ML + doc.getTextWidth("現場名:") + 3;
  doc.text(data.siteName, siteNameX, y);

  y += 8;

  // 納品希望日
  doc.setFont("NotoSansJP", "bold");
  doc.text("納品希望日:", ML, y);
  doc.setFont("NotoSansJP", "normal");
  const dateX = ML + doc.getTextWidth("納品希望日:") + 3;
  doc.text(dateJP(data.deliveryDate), dateX, y);

  return y + 10;
}

/**
 * ご注文金額ボックス（中央・枠線・大文字）
 */
function drawAmountBox(doc: jsPDF, data: OrderSheetPdfData, y: number): number {
  const boxW = 145;
  const boxH = 22;
  const boxX = (210 - boxW) / 2;

  // 外枠
  doc.setLineWidth(0.5);
  doc.rect(boxX, y, boxW, boxH);

  // テキスト
  doc.setFontSize(18);
  doc.setFont("NotoSansJP", "bold");
  doc.text(
    `ご注文金額: ${yenFmt(data.totalAmount)}（税込）`,
    105,
    y + boxH / 2 + 3,
    { align: "center" }
  );
  doc.setFont("NotoSansJP", "normal");

  return y + boxH + 12;
}

/**
 * 明細テーブル（実データ行のみ、空行パディングなし）
 */
function drawPriceTable(doc: jsPDF, data: OrderSheetPdfData, y: number): number {
  // データ行を構築
  const bodyRows = data.priceDetails.map((p, i) => {
    const amount = Math.ceil(p.quantity * p.priceUnit);
    return [
      String(i + 1),
      p.name,
      p.specifications || "",
      p.unit,
      String(p.quantity),
      yenFmt(p.priceUnit),
      yenFmt(amount),
    ];
  });

  // 最低1行は確保（データが0件の場合）
  if (bodyRows.length === 0) {
    bodyRows.push(["", "", "", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    head: [["No.", "項目（商品名称）", "品番・規格", "単位", "数量", "単価", "金額"]],
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
      1: { cellWidth: COL_W[1] },
      2: { cellWidth: COL_W[2] },
      3: { cellWidth: COL_W[3], halign: "center" },
      4: { cellWidth: COL_W[4], halign: "right" },
      5: { cellWidth: COL_W[5], halign: "right" },
      6: { cellWidth: COL_W[6], halign: "right" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY: number = (doc as any).lastAutoTable?.finalY ?? y + 100;
  return finalY;
}

/**
 * 集計行（小計・消費税・合計）— テーブル右下
 */
function drawSummaryRows(doc: jsPDF, data: OrderSheetPdfData, y: number): number {
  const labelX = ML + COL_W[0] + COL_W[1] + COL_W[2] + COL_W[3];
  const labelW = COL_W[4] + COL_W[5];
  const amountX = labelX + labelW;
  const amountW = COL_W[6];
  const rowH = 9;

  y += 2; // テーブルからの間隔

  const rows = [
    { label: "小計", amount: yenFmt(data.subtotal), bold: false },
    { label: "消費税（10%）", amount: yenFmt(data.taxAmount10), bold: false },
    { label: "合計", amount: yenFmt(data.totalAmount), bold: true },
  ];

  doc.setLineWidth(0.3);
  doc.setDrawColor(50, 50, 50);

  rows.forEach((row, i) => {
    const ry = y + i * rowH;

    // セル枠
    doc.rect(labelX, ry, labelW, rowH);
    doc.rect(amountX, ry, amountW, rowH);

    // ラベル
    doc.setFontSize(9);
    doc.setFont("NotoSansJP", row.bold ? "bold" : "normal");
    doc.text(row.label, labelX + 4, ry + rowH / 2 + 1.2);

    // 金額（右寄せ）
    doc.setFontSize(row.bold ? 10 : 9);
    doc.text(row.amount, amountX + amountW - 4, ry + rowH / 2 + 1.2, { align: "right" });
  });

  doc.setFont("NotoSansJP", "normal");
  doc.setDrawColor(0, 0, 0);

  return y + rows.length * rowH + 12;
}

/**
 * 【備考】セクション
 */
function drawRemarks(doc: jsPDF, data: OrderSheetPdfData, y: number): number {
  doc.setFontSize(10.5);
  doc.setFont("NotoSansJP", "bold");
  doc.text("【備考】", ML, y);
  doc.setFont("NotoSansJP", "normal");

  y += 7;
  if (data.remarks) {
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(data.remarks, CW);
    doc.text(lines, ML, y);
    y += lines.length * 5.5;
  }

  return y + 5;
}

// ============ Main export ============

export function generateOrderSheetPdf(data: OrderSheetPdfData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFont(doc);

  let y = drawTitleAndDocInfo(doc, data);

  // 左: 宛先（受注者） / 右: 発行元（発注者）+ 印鑑 — 並列描画
  const recipientEndY = drawRecipient(doc, data, y);
  const issuerEndY = drawIssuerBlock(doc, data, y);
  y = Math.max(recipientEndY, issuerEndY) + 8;

  y = drawSiteInfo(doc, data, y);
  y = drawAmountBox(doc, data, y);
  y = drawPriceTable(doc, data, y);
  y = drawSummaryRows(doc, data, y);
  drawRemarks(doc, data, y);

  return doc.output("datauristring");
}
