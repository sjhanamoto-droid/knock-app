/**
 * 施工写真のアップロード（クライアント用）。施工報告と同じく、画像をリサイズ・JPEG圧縮してから
 * /api/upload（Vercel Blob）へ送り、短いURLの配列を返す。
 */

export const MAX_PHOTO_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function compressImage(file: File, maxDim = 1280, quality = 0.65): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : null;
  } catch {
    return null;
  }
}

export async function uploadPhotos(files: File[]): Promise<string[]> {
  if (files.some((f) => f.size > MAX_PHOTO_FILE_SIZE)) {
    throw new Error("10MBを超えるファイルがあります。サイズを確認してください。");
  }
  const formData = new FormData();
  for (const f of files) {
    const compressed = await compressImage(f);
    if (compressed) {
      formData.append("files", compressed, (f.name || "photo").replace(/\.[^.]+$/, "") + ".jpg");
    } else {
      formData.append("files", f);
    }
  }
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error("写真のアップロードに失敗しました");
  const data = await res.json();
  return data.urls ?? data.files?.map((f: { url: string }) => f.url) ?? [];
}
