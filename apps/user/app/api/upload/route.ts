import { NextRequest, NextResponse } from "next/server";
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

  const urls: string[] = [];

  for (const file of files) {
    const err = validateImageOrPdf(file);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "application/octet-stream";
    urls.push(`data:${mimeType};base64,${base64}`);
  }

  return NextResponse.json({ urls });
}
