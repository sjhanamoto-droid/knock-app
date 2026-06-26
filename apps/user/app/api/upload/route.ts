import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireSession } from "@/lib/session";
import { validateImageOrPdf } from "@/lib/upload-limits";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  }

  try {
    const urls: string[] = [];

    for (const file of files) {
      const err = validateImageOrPdf(file);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }

      // 画像/PDFを Vercel Blob（実ストレージ）に保存し、短い公開URLだけを返す。
      // 以前は base64 データURIを返していたため、これを呼び出し元が
      // サーバーアクションのボディに含めて送信し、写真複数枚で
      // Vercelのボディ上限(約4.5MB)を超えて送信失敗していた。
      // URLを返すようにすることで、その上限問題を根本的に解消する。
      const blob = await put(`uploads/${file.name || "file"}`, file, {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type || undefined,
      });
      urls.push(blob.url);
    }

    return NextResponse.json({ urls });
  } catch (e) {
    console.error("[api/upload] blob put failed:", e);
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }
}
