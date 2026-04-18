import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  }

  const urls: string[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "application/octet-stream";
    urls.push(`data:${mimeType};base64,${base64}`);
  }

  return NextResponse.json({ urls });
}
