import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Test 1: getProfile query
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        company: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            billingClosingDay: true,
            billingGraceDays: true,
            paymentDueType: true,
          },
        },
      },
    });

    // Test 2: updateCompany (dry run - just read, no write)
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { registrationStep: true, name: true },
    });

    return NextResponse.json({
      ok: true,
      userId: user.id,
      companyId: user.companyId,
      companyName: profile?.company?.name,
      registrationStep: company?.registrationStep,
      hasLatLng: !!(profile?.company?.latitude && profile?.company?.longitude),
      latType: profile?.company?.latitude ? typeof profile.company.latitude : "null",
      billingClosingDay: profile?.company?.billingClosingDay,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();

    // Actually try the update with minimal data
    await prisma.company.update({
      where: { id: user.companyId },
      data: { name: body.name || "テスト" },
    });

    return NextResponse.json({ ok: true, message: "Update succeeded" });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
    }, { status: 500 });
  }
}
