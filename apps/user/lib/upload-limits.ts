/**
 * アップロード共通バリデーション
 * /api/upload（画像・図面・見積など）と /api/chat/send-file（チャット添付）で共用。
 * 目的: (1) base64 を DB に保存するためファイルサイズを制限し肥大化を防ぐ
 *       (2) data:text/html / SVG 由来の保存型 XSS を避けるため危険な形式を弾く
 */

/** 1ファイルあたりの上限。Vercel のリクエストボディ上限内に収める。 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

const IMAGE_PDF_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const IMAGE_PDF_EXT = /\.(jpe?g|png|gif|webp|heic|heif|pdf)$/i;

// スクリプト実行や保存型 XSS に繋がり得る形式は常に拒否する。
const DANGEROUS_MIME = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
]);
const DANGEROUS_EXT = /\.(html?|xhtml|svg|js|mjs|exe|sh|bat|cmd|com|scr|msi|dll)$/i;

const sizeMB = Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024);

function checkSize(file: File): string | null {
  if (file.size === 0) return "空のファイルです";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `ファイルサイズが大きすぎます（1ファイルあたり上限 ${sizeMB}MB）`;
  }
  return null;
}

/** 画像 or PDF のみ許可（/api/upload 用）。問題があればエラーメッセージ、無ければ null。 */
export function validateImageOrPdf(file: File): string | null {
  const sizeErr = checkSize(file);
  if (sizeErr) return sizeErr;

  const mime = (file.type || "").toLowerCase();
  const okMime = mime ? IMAGE_PDF_MIME.has(mime) : false;
  const okExt = IMAGE_PDF_EXT.test(file.name || "");
  // MIME が取れない端末向けに拡張子も許容。どちらかが許可リストに合致すれば OK。
  if (!okMime && !okExt) return "対応していないファイル形式です（画像または PDF のみ）";
  return null;
}

/** チャット添付（書類も許容）。危険な形式のみ拒否しサイズを制限する。 */
export function validateChatFile(file: File): string | null {
  const sizeErr = checkSize(file);
  if (sizeErr) return sizeErr;

  const mime = (file.type || "").toLowerCase();
  if (DANGEROUS_MIME.has(mime) || DANGEROUS_EXT.test(file.name || "")) {
    return "このファイル形式は送信できません";
  }
  return null;
}
