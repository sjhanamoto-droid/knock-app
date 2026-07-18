import { jsPDF } from "jspdf";
import { setupFont, dateJP } from "./pdf-utils";
import {
  CONTRACT_TITLE,
  YAKKAN_TITLE,
  AGREEMENT_PREAMBLE,
  AGREEMENT_BODY,
  AGREEMENT_ATTESTATION,
  YAKKAN_ARTICLES,
  type ContractArticle,
} from "@/lib/contract-content";

export interface SubcontractPdfData {
  /** 元請負人＝発注者の会社名 */
  ordererName: string;
  /** 下請負人＝受注者の会社名 */
  contractorName: string;
  /** 契約日（＝交渉ルーム作成日／マッチング日） */
  matchedAt: Date;
}

// A4 portrait, mm
const ML = 20;
const CW = 170;
const TOP = 20;
const BOTTOM = 282;

/**
 * 工事下請基本契約書のPDFを生成し data URI 文字列を返す（サーバー側）。
 * jsPDF + NotoSansJP。内容が長いので複数ページに自動改ページする。
 */
export function generateSubcontractPdf(data: SubcontractPdfData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFont(doc);

  let y = 26;

  const ensure = (space: number) => {
    if (y + space > BOTTOM) {
      doc.addPage();
      y = TOP;
    }
  };

  const heading = (text: string, size: number) => {
    ensure(size * 0.6 + 6);
    doc.setFont("NotoSansJP", "bold");
    doc.setFontSize(size);
    doc.text(text, 105, y, { align: "center" });
    y += size * 0.5 + 6;
    doc.setFont("NotoSansJP", "normal");
  };

  const para = (
    text: string,
    opts: { size?: number; bold?: boolean; indent?: number; lh?: number; gap?: number } = {}
  ) => {
    const { size = 9.5, bold = false, indent = 0, lh = 5.4, gap = 1.5 } = opts;
    const x = ML + indent;
    const w = CW - indent;
    doc.setFont("NotoSansJP", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, w) as string[];
    for (const line of lines) {
      ensure(lh);
      doc.text(line, x, y);
      y += lh;
    }
    y += gap;
    doc.setFont("NotoSansJP", "normal");
  };

  const article = (a: ContractArticle) => {
    para(a.title, { size: 10, bold: true, gap: 0.8 });
    for (const b of a.blocks) {
      para(b.text, { size: 9.5, indent: b.indent === 1 ? 6 : 0, gap: 1.2 });
    }
    y += 1.5;
  };

  // ── 契約書（第1面） ──
  heading(CONTRACT_TITLE, 16);
  y += 2;

  para(`元請負人　　${data.ordererName}`, { size: 10.5, gap: 1 });
  para(`下請負人　　${data.contractorName}`, { size: 10.5, gap: 3 });

  para(AGREEMENT_PREAMBLE, { gap: 3 });

  for (const a of AGREEMENT_BODY) article(a);

  para(AGREEMENT_ATTESTATION, { gap: 4 });

  // 契約日（マッチング日）
  para(`　　${dateJP(data.matchedAt)}`, { size: 10.5, gap: 4 });

  // 署名欄（住所・押印なし、氏名＝会社名）
  para(`元請負人　　氏名　${data.ordererName}`, { size: 10.5, gap: 2 });
  para(`下請負人　　氏名　${data.contractorName}`, { size: 10.5, gap: 2 });

  // ── 約款 ──
  doc.addPage();
  y = 26;
  heading(YAKKAN_TITLE, 13);
  y += 2;
  for (const a of YAKKAN_ARTICLES) article(a);

  return doc.output("datauristring");
}
