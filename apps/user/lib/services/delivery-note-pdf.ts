import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { setupFont, yenFmt, dateJP, ML, MR, RE, CW } from "./pdf-utils";

// ============ Types ============
export interface DeliveryNotePdfData {
  documentNumber: string;
  issuedAt: Date;
  /** 発行者（右側） = 受注者 */
  workCompanyName: string;
  workCompanyPostalCode: string;
  workCompanyAddress: string;
  workCompanyInvoiceNumber: string;
  workCompanyTel: string;
  workCompanyEmail: string;
  /** 受取人 = 発注者 */
  orderCompanyName: string;
  siteName: string;
  siteAddress: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  completionDate: string | Date | null;
  priceDetails: {
    name: string;
    quantity: number;
    unit: string;
    priceUnit: number;
    adjustedPriceUnit?: number;
  }[];
  subtotal: number;
  taxAmount10: number;
  totalAmount: number;
  stampImageBase64?: string;
  /** 追加工事明細 */
  additionalItems?: {
    name: string;
    quantity: number;
    unit: string;
    priceUnit: number;
    specifications: string;
  }[];
  /** 諸経費（税込） */
  expenses?: number;
  /** 調整金額（税込） */
  adjustmentAmount?: number;
  /** 前払金 */
  advancePayment?: number;
  /** 備考 */
  memo?: string;
}

// 7 columns: No. | 名称 | 仕様・摘要 | 単位 | 数量 | 単価 | 金額
const COL_W = [13, 40, 32, 15, 15, 23, 27]; // total = 165

// ============ Drawing functions ============

/**
 * タイトル「納 品 書」— 中央・太字・下線
 */
function drawTitle(doc: jsPDF): number {
  doc.setFontSize(24);
  doc.setFont("NotoSansJP", "bold");
  const title = "納 品 書";
  doc.text(title, 105, 28, { align: "center" });

  const tw = doc.getTextWidth(title);
  doc.setLineWidth(0.8);
  doc.line(105 - tw / 2, 31, 105 + tw / 2, 31);

  doc.setFont("NotoSansJP", "normal");
  return 42;
}

/**
 * 宛先（左）+ 納品番号・発行日（右）
 */
function drawRecipientAndDocInfo(doc: jsPDF, data: DeliveryNotePdfData, startY: number): number {
  let y = startY;

  // ── 左側: 宛先（発注者） ──
  doc.setFontSize(14);
  doc.setFont("NotoSansJP", "bold");
  doc.text(`${data.orderCompanyName} 御中`, ML, y);
  doc.setFont("NotoSansJP", "normal");

  y += 10;
  doc.setFontSize(9.5);
  doc.text("下記の通り御納品申し上げます。", ML, y);

  // ── 右側: 納品番号・発行日 ──
  doc.setFontSize(9.5);
  doc.text(`納品番号: ${data.documentNumber}`, RE, startY, { align: "right" });
  doc.text(`発行日: ${dateJP(data.issuedAt)}`, RE, startY + 6, { align: "right" });

  return y + 8;
}

/**
 * 発行者情報（受注者）— 右寄せブロック（左側と同じ高さに描画）
 */
function drawIssuerBlock(doc: jsPDF, data: DeliveryNotePdfData, startY: number): void {
  const blockX = 130;
  let y = startY;

  doc.setFontSize(12);
  doc.setFont("NotoSansJP", "bold");
  doc.text(data.workCompanyName, blockX, y);
  doc.setFont("NotoSansJP", "normal");

  y += 7;
  doc.setFontSize(9.5);

  if (data.workCompanyPostalCode) {
    doc.text(`〒${data.workCompanyPostalCode}`, blockX, y);
    y += 5.5;
  }
  if (data.workCompanyAddress) {
    doc.text(data.workCompanyAddress, blockX, y);
    y += 5.5;
  }
  if (data.workCompanyInvoiceNumber) {
    doc.text(`登録番号: ${data.workCompanyInvoiceNumber}`, blockX, y);
    y += 5.5;
  }
  if (data.workCompanyTel) {
    doc.text(`TEL: ${data.workCompanyTel}`, blockX, y);
    y += 5.5;
  }
  if (data.workCompanyEmail) {
    doc.text(`Email: ${data.workCompanyEmail}`, blockX, y);
  }

  // 印鑑 — PNG画像がある場合のみ表示
  if (data.stampImageBase64) {
    const stampSize = 18;
    doc.addImage(data.stampImageBase64, "PNG", RE - stampSize - 1, startY + 3, stampSize, stampSize);
  }
}

/**
 * 現場情報・工期
 */
function drawSiteInfo(doc: jsPDF, data: DeliveryNotePdfData, y: number): number {
  doc.setFontSize(10.5);

  // 現場名
  doc.setFont("NotoSansJP", "bold");
  doc.text("現場名:", ML, y);
  doc.setFont("NotoSansJP", "normal");
  const siteNameX = ML + doc.getTextWidth("現場名:") + 3;
  doc.text(data.siteName, siteNameX, y);

  y += 7;

  // 工事場所
  if (data.siteAddress) {
    doc.setFont("NotoSansJP", "bold");
    doc.text("工事場所:", ML, y);
    doc.setFont("NotoSansJP", "normal");
    const addrX = ML + doc.getTextWidth("工事場所:") + 3;
    doc.text(data.siteAddress, addrX, y);
    y += 7;
  }

  // 工期
  doc.setFont("NotoSansJP", "bold");
  doc.text("工期:", ML, y);
  doc.setFont("NotoSansJP", "normal");
  const periodX = ML + doc.getTextWidth("工期:") + 3;
  doc.text(`${dateJP(data.startDate)} 〜 ${dateJP(data.endDate)}`, periodX, y);

  y += 7;

  // 完工日
  if (data.completionDate) {
    doc.setFont("NotoSansJP", "bold");
    doc.text("完工日:", ML, y);
    doc.setFont("NotoSansJP", "normal");
    const compX = ML + doc.getTextWidth("完工日:") + 3;
    doc.text(dateJP(data.completionDate), compX, y);
    y += 7;
  }

  return y + 4;
}

/**
 * ご納品金額ボックス
 */
function drawAmountBox(doc: jsPDF, data: DeliveryNotePdfData, y: number): number {
  const boxW = 145;
  const boxH = 22;
  const boxX = (210 - boxW) / 2;

  // 前払金がある場合はお支払金額を表示
  const displayAmount = data.advancePayment
    ? data.totalAmount - data.advancePayment
    : data.totalAmount;

  doc.setLineWidth(0.5);
  doc.rect(boxX, y, boxW, boxH);

  doc.setFontSize(18);
  doc.setFont("NotoSansJP", "bold");
  doc.text(
    `ご納品金額: ${yenFmt(displayAmount)}（税込）`,
    105,
    y + boxH / 2 + 3,
    { align: "center" }
  );
  doc.setFont("NotoSansJP", "normal");

  return y + boxH + 12;
}

/**
 * 明細テーブル
 */
function drawPriceTable(doc: jsPDF, data: DeliveryNotePdfData, y: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bodyRows: any[][] = data.priceDetails.map((p, i) => {
    const effectivePrice = p.adjustedPriceUnit ?? p.priceUnit;
    const amount = Math.ceil(p.quantity * effectivePrice);
    return [
      String(i + 1),
      p.name,
      "",
      p.unit,
      String(p.quantity),
      yenFmt(effectivePrice),
      yenFmt(amount),
    ];
  });

  // 追加工事明細を追加
  if (data.additionalItems?.length) {
    bodyRows.push([
      { content: "【追加工事】", colSpan: 7, styles: { halign: "left", fontStyle: "bold", fillColor: [240, 240, 240] } },
    ]);
    data.additionalItems.forEach((item, i) => {
      const amount = Math.ceil(item.quantity * item.priceUnit);
      bodyRows.push([
        String(data.priceDetails.length + i + 1),
        item.name,
        item.specifications || "",
        item.unit || "",
        String(item.quantity),
        yenFmt(item.priceUnit),
        yenFmt(amount),
      ]);
    });
  }

  // 最低1行は確保（データが0件の場合）
  if (bodyRows.length === 0) {
    bodyRows.push(["", "", "", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    head: [["No.", "名称", "仕様・摘要", "単位", "数量", "単価", "金額"]],
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
 * 集計行（小計・消費税・合計）
 */
function drawSummaryRows(doc: jsPDF, data: DeliveryNotePdfData, y: number): number {
  const labelX = ML + COL_W[0] + COL_W[1] + COL_W[2] + COL_W[3];
  const labelW = COL_W[4] + COL_W[5];
  const amountX = labelX + labelW;
  const amountW = COL_W[6];
  const rowH = 9;

  y += 2;

  const rows: { label: string; amount: string; bold: boolean }[] = [
    { label: "小計", amount: yenFmt(data.subtotal), bold: false },
  ];

  // 追加工事小計
  if (data.additionalItems?.length) {
    const additionalTotal = data.additionalItems.reduce(
      (sum, item) => sum + Math.ceil(item.quantity * item.priceUnit), 0
    );
    rows.push({ label: "追加工事小計", amount: yenFmt(additionalTotal), bold: false });
  }

  // 諸経費
  if (data.expenses) {
    rows.push({ label: "諸経費（税込）", amount: yenFmt(data.expenses), bold: false });
  }

  // 調整金額
  if (data.adjustmentAmount) {
    rows.push({ label: "調整金額（税込）", amount: yenFmt(data.adjustmentAmount), bold: false });
  }

  rows.push({ label: "消費税（10%）", amount: yenFmt(data.taxAmount10), bold: false });
  rows.push({ label: "合計", amount: yenFmt(data.totalAmount), bold: true });

  // 前払金・お支払金額
  if (data.advancePayment) {
    rows.push({ label: "前払金控除", amount: `▲${yenFmt(data.advancePayment)}`, bold: false });
    const payment = data.totalAmount - data.advancePayment;
    rows.push({ label: "お支払金額", amount: yenFmt(payment), bold: true });
  }

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

/**
 * 備考欄
 */
function drawMemo(doc: jsPDF, memo: string, y: number): number {
  doc.setFontSize(10);
  doc.setFont("NotoSansJP", "bold");
  doc.text("備考", ML, y);
  doc.setFont("NotoSansJP", "normal");
  y += 6;

  doc.setFontSize(9);
  const lines = doc.splitTextToSize(memo, CW);
  doc.text(lines, ML, y);
  y += lines.length * 5 + 4;

  return y;
}

// ============ Main export ============

export function generateDeliveryNotePdf(data: DeliveryNotePdfData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFont(doc);

  let y = drawTitle(doc);
  y = drawRecipientAndDocInfo(doc, data, y);

  // 左側: 宛先の続き位置 / 右側: 発行者情報（同じ高さに並列描画）
  drawIssuerBlock(doc, data, y);
  y += 32; // 発行者ブロック分のスペースを確保

  y = drawSiteInfo(doc, data, y);
  y = drawAmountBox(doc, data, y);
  y = drawPriceTable(doc, data, y);
  y = drawSummaryRows(doc, data, y);

  // 備考
  if (data.memo) {
    y = drawMemo(doc, data.memo, y);
  }

  return doc.output("datauristring");
}
