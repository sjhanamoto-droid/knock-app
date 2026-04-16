import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

// ============ Font cache ============
let cachedRegularBase64: string | null = null;
let cachedBoldBase64: string | null = null;

function resolveFont(filename: string): string {
  let fontPath = path.join(process.cwd(), `lib/fonts/${filename}`);
  if (!fs.existsSync(fontPath)) {
    fontPath = path.join(process.cwd(), `apps/user/lib/fonts/${filename}`);
  }
  if (!fs.existsSync(fontPath)) {
    console.warn(`[PDF] Font file not found: ${filename}`);
    return "";
  }
  return fs.readFileSync(fontPath).toString("base64");
}

function loadFonts(): { regular: string; bold: string } {
  if (!cachedRegularBase64) {
    cachedRegularBase64 = resolveFont("NotoSansJP-Regular.ttf");
  }
  if (!cachedBoldBase64) {
    cachedBoldBase64 = resolveFont("NotoSansJP-Bold.ttf");
    if (!cachedBoldBase64) {
      console.warn("[PDF] Bold font not found, falling back to Regular");
      cachedBoldBase64 = cachedRegularBase64;
    }
  }
  return { regular: cachedRegularBase64!, bold: cachedBoldBase64! };
}

export function setupFont(doc: jsPDF) {
  const { regular, bold } = loadFonts();
  doc.addFileToVFS("NotoSansJP-Regular.ttf", regular);
  doc.addFileToVFS("NotoSansJP-Bold.ttf", bold);
  doc.addFont("NotoSansJP-Regular.ttf", "NotoSansJP", "normal");
  doc.addFont("NotoSansJP-Bold.ttf", "NotoSansJP", "bold");
  doc.setFont("NotoSansJP", "normal");
}

// ============ Helpers ============
export function yenFmt(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

export function dateJP(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ============ Layout constants ============
export const ML = 25;   // left margin
export const MR = 20;   // right margin
export const RE = 210 - MR; // right edge = 190
export const CW = RE - ML;  // content width = 165
