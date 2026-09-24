import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { setupFont, yenFmt, dateJP, ML, MR, RE, CW } from "./pdf-utils";

// ============ Types ============
export interface OrderSheetPdfData {
  // ORDER_SHEET=注文書(発注者→受注者) / ORDER_ACCEPTANCE=注文請書(受注者→発注者)。省略時は注文書。
  variant?: "ORDER_SHEET" | "ORDER_ACCEPTANCE";
  documentNumber: string;
  // 注文請書のみ: 請け負う注文書の番号
  orderSheetNumber?: string;
  issuedAt: Date;
  // 受注者（注文書では宛先 / 注文請書では発行元）
  workerCompanyName: string;
  workerCompanyPostalCode?: string;
  workerCompanyAddress: string;
  workerCompanyTel: string;
  workerCompanyFax: string;
  contactPersonName: string;
  // 発注者（注文書では発行元 / 注文請書では宛先）
  orderCompanyName: string;
  orderCompanyPostalCode: string;
  orderCompanyAddress: string;
  orderCompanyTel: string;
  orderCompanyRepresentative: string;
  // 現場情報
  siteName: string;
  siteCode: string;
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
  // 発行元の印鑑（注文書=発注者 / 注文請書=受注者）
  stampImageBase64?: string;
}

const isAcceptance = (data: OrderSheetPdfData) => data.variant === "ORDER_ACCEPTANCE";

/**
 * 宛先・発行元の会社情報。注文請書は注文書の発注者/受注者を入れ替える。
 * 担当者(現場作成者＝発注者側)は発行元の欄にのみ表示する（注文書のみ。注文請書では渡さない）。
 */
function getParties(data: OrderSheetPdfData) {
  const orderer = {
    name: data.orderCompanyName,
    postalCode: data.orderCompanyPostalCode,
    address: data.orderCompanyAddress,
    tel: data.orderCompanyTel,
    fax: "",
    contactPersonName: data.contactPersonName,
    representative: data.orderCompanyRepresentative,
  };
  const worker = {
    name: data.workerCompanyName,
    postalCode: data.workerCompanyPostalCode ?? "",
    address: data.workerCompanyAddress,
    tel: data.workerCompanyTel,
    fax: data.workerCompanyFax,
    contactPersonName: "",
    representative: "",
  };
  return isAcceptance(data)
    ? { recipient: orderer, issuer: worker }
    : { recipient: worker, issuer: orderer };
}

// 7 columns: No. | 項目 | 品番・規格 | 単位 | 数量 | 単価 | 金額
const COL_W = [13, 40, 32, 15, 15, 23, 27]; // total = 165

// ============ Drawing functions ============

/**
 * タイトル「注 文 書」/「注 文 請 書」+ 番号・発行日（右上ヘッダー）
 */
function drawTitleAndDocInfo(doc: jsPDF, data: OrderSheetPdfData): number {
  const acceptance = isAcceptance(data);

  // タイトル中央
  doc.setFontSize(24);
  doc.setFont("NotoSansJP", "bold");
  const title = acceptance ? "注 文 請 書" : "注 文 書";
  doc.text(title, 105, 28, { align: "center" });

  // 下線（太め）
  const tw = doc.getTextWidth(title);
  doc.setLineWidth(0.8);
  doc.line(105 - tw / 2, 31, 105 + tw / 2, 31);

  // 右上: 番号・発行日（注文請書は請書番号＋対応する注文番号）
  doc.setFont("NotoSansJP", "normal");
  doc.setFontSize(9);
  if (acceptance) {
    doc.text(`請書番号: ${data.documentNumber}`, RE, 12, { align: "right" });
    doc.text(`注文番号: ${data.orderSheetNumber ?? ""}`, RE, 18, { align: "right" });
  } else {
    doc.text(`注文番号: ${data.documentNumber}`, RE, 18, { align: "right" });
  }
  doc.text(`発行日: ${dateJP(data.issuedAt)}`, RE, 24, { align: "right" });

  return 42;
}

/**
 * 宛先（左側）— 注文書=受注者 / 注文請書=発注者
 */
function drawRecipient(doc: jsPDF, data: OrderSheetPdfData, startY: number): number {
  const { recipient } = getParties(data);
  let y = startY;

  // 会社名 御中（太字・大きめ）
  doc.setFontSize(14);
  doc.setFont("NotoSansJP", "bold");
  doc.text(`${recipient.name} 御中`, ML, y);
  doc.setFont("NotoSansJP", "normal");

  y += 10;
  doc.setFontSize(9.5);

  if (recipient.address) {
    doc.text(recipient.address, ML, y);
    y += 5.5;
  }
  if (recipient.tel) {
    doc.text(`TEL: ${recipient.tel}`, ML, y);
    y += 5.5;
  }
  if (recipient.fax) {
    doc.text(`FAX: ${recipient.fax}`, ML, y);
    y += 5.5;
  }

  return y;
}

/**
 * 発行元会社情報（右側）+ 印鑑 — 宛先と並列描画。注文書=発注者 / 注文請書=受注者
 */
function drawIssuerBlock(doc: jsPDF, data: OrderSheetPdfData, startY: number): number {
  const { issuer } = getParties(data);
  const blockX = 130;
  let y = startY;

  // 会社名（太字）
  doc.setFontSize(11);
  doc.setFont("NotoSansJP", "bold");
  doc.text(issuer.name, blockX, y);
  doc.setFont("NotoSansJP", "normal");

  y += 6;
  doc.setFontSize(8.5);

  if (issuer.postalCode) {
    doc.text(`〒${issuer.postalCode}`, blockX, y);
    y += 5;
  }
  if (issuer.address) {
    doc.text(issuer.address, blockX, y);
    y += 5;
  }
  // 担当者（現場作成者＝発注者側の担当）は発注者の住所の直下に表示する
  if (issuer.contactPersonName) {
    doc.text(`担当者: ${issuer.contactPersonName}`, blockX, y);
    y += 5;
  }
  if (issuer.tel) {
    doc.text(`TEL: ${issuer.tel}`, blockX, y);
    y += 5;
  }
  if (issuer.representative) {
    doc.text(`代表: ${issuer.representative}`, blockX, y);
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
 * 注文請書のみ: 請ける旨の文言
 */
function drawAcceptanceLead(doc: jsPDF, data: OrderSheetPdfData, y: number): number {
  if (!isAcceptance(data)) return y;
  doc.setFontSize(10);
  doc.setFont("NotoSansJP", "normal");
  doc.text("下記のとおり、ご注文をお請けいたします。", ML, y);
  return y + 9;
}

/**
 * 現場名・現場コード
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

  // 現場コード
  if (data.siteCode) {
    doc.setFont("NotoSansJP", "bold");
    doc.text("現場コード:", ML, y);
    doc.setFont("NotoSansJP", "normal");
    const codeX = ML + doc.getTextWidth("現場コード:") + 3;
    doc.text(data.siteCode, codeX, y);
    y += 8;
  }

  return y + 2;
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
    `${isAcceptance(data) ? "ご請負金額" : "ご注文金額"}: ${yenFmt(data.totalAmount)}（税込）`,
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

  // 左: 宛先 / 右: 発行元 + 印鑑 — 並列描画（注文請書は発注者/受注者が入れ替わる）
  const recipientEndY = drawRecipient(doc, data, y);
  const issuerEndY = drawIssuerBlock(doc, data, y);
  y = Math.max(recipientEndY, issuerEndY) + 8;

  y = drawAcceptanceLead(doc, data, y);
  y = drawSiteInfo(doc, data, y);
  y = drawAmountBox(doc, data, y);
  y = drawPriceTable(doc, data, y);
  y = drawSummaryRows(doc, data, y);
  drawRemarks(doc, data, y);

  return doc.output("datauristring");
}
