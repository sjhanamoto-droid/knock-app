"use server";

import { prisma } from "@/lib/prisma";
import { getEffectivePrice } from "@knock/utils";
import { requireSession } from "@/lib/session";

/**
 * 自社のサブスクリプション一覧を取得
 */
export async function getSubscriptions() {
  const user = await requireSession();

  const subs = await prisma.subscription.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "asc" },
  });

  return subs.map((s) => ({
    ...s,
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
    currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    canceledAt: s.canceledAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

/**
 * サブスクリプションを作成（タイプ追加時に呼ばれる）
 * テスト期間中は TRIAL ステータス・料金0で作成される。
 */
export async function createSubscription(planType: "CONTRACTOR" | "ORDERER") {
  const user = await requireSession();

  // 代表者・管理者のみ
  if (user.role !== "REPRESENTATIVE" && user.role !== "MANAGER") {
    throw new Error("権限がありません");
  }

  // 既存のサブスクリプションがあればスキップ
  const existing = await prisma.subscription.findUnique({
    where: { companyId_planType: { companyId: user.companyId, planType } },
  });
  if (existing) {
    return { success: true, subscriptionId: existing.id, alreadyExists: true };
  }

  const price = getEffectivePrice(planType);

  const sub = await prisma.subscription.create({
    data: {
      companyId: user.companyId,
      planType,
      status: "TRIAL",
      priceMonthly: price,
    },
  });

  return { success: true, subscriptionId: sub.id, alreadyExists: false };
}
