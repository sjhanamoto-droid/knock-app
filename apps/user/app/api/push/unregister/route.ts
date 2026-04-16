import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  try {
    await requireSession();
    const { token } = (await req.json()) as { token?: string };
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    await prisma.deviceToken.deleteMany({ where: { token } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal Server Error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
