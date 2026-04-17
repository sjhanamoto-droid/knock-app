import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await requireSession();
    const { subscription } = (await req.json()) as {
      subscription?: PushSubscription;
    };
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "subscription is required" },
        { status: 400 }
      );
    }

    const token = JSON.stringify(subscription);

    // Use endpoint as unique identifier, store full subscription as token
    await prisma.deviceToken.upsert({
      where: { token },
      create: {
        userId: user.id,
        token,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
      update: {
        userId: user.id,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal Server Error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
