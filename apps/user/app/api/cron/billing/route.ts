import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDraftInvoices, autoConfirmOverdueInvoices } from "@/lib/actions/invoices";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = now.getDate();

  try {
    // 1. 締め日が今日の会社のドラフト請求書を生成
    const companies = await prisma.company.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { billingClosingDay: today },
          // 月末締め: 月の最終日
          ...(isLastDayOfMonth(now) ? [{ billingClosingDay: null }] : []),
        ],
      },
      select: { id: true },
    });

    let generatedCount = 0;
    for (const company of companies) {
      const ids = await generateDraftInvoices(company.id);
      generatedCount += ids.length;

      // 発注者に通知
      if (ids.length > 0) {
        const ordererUsers = await prisma.user.findMany({
          where: { companyId: company.id, isActive: true, deletedAt: null },
          select: { id: true },
        });

        const ym = `${now.getFullYear()}年${now.getMonth() + 1}月`;
        if (ordererUsers.length > 0) {
          await prisma.notification.createMany({
            data: ordererUsers.map((u) => ({
              userId: u.id,
              title: "請求書ドラフト生成",
              content: `${ym}分の請求書（${ids.length}件）が確認可能です`,
              type: 40,
              targetId: ids[0],
            })),
          });
        }
      }
    }

    // 2. 猶予期限超過の自動確定
    const { confirmedCount } = await autoConfirmOverdueInvoices();

    return NextResponse.json({
      success: true,
      generatedCount,
      confirmedCount,
      companiesChecked: companies.length,
    });
  } catch (error) {
    console.error("[Cron/Billing] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

function isLastDayOfMonth(date: Date): boolean {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.getDate() === 1;
}
