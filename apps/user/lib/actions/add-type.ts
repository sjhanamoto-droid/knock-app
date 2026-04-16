"use server";

import { prisma } from "@/lib/prisma";
import { getEffectivePrice } from "@knock/utils";
import { requireSession } from "@/lib/session";

/**
 * 会社タイプを BOTH にアップグレードし、新タイプのサブスクリプションを作成する。
 * 受注者のみ → 発注者機能を追加、またはその逆。
 */
export async function upgradeCompanyType() {
  const user = await requireSession();

  // 代表者・管理者のみ許可
  if (user.role !== "REPRESENTATIVE" && user.role !== "MANAGER") {
    throw new Error("権限がありません。代表者または管理者のみ実行できます。");
  }

  // 既に BOTH なら何もしない
  if (user.companyType === "BOTH") {
    return { success: true, alreadyBoth: true };
  }

  const currentType = user.companyType as "ORDERER" | "CONTRACTOR";
  const newType = currentType === "CONTRACTOR" ? "ORDERER" : "CONTRACTOR";

  await prisma.$transaction(async (tx) => {
    // 1. 会社タイプを BOTH に変更
    await tx.company.update({
      where: { id: user.companyId },
      data: { type: "BOTH" },
    });

    // 2. 既存タイプのサブスクリプションがなければ作成（初期ユーザー対応）
    const existingSub = await tx.subscription.findUnique({
      where: { companyId_planType: { companyId: user.companyId, planType: currentType } },
    });
    if (!existingSub) {
      await tx.subscription.create({
        data: {
          companyId: user.companyId,
          planType: currentType,
          status: "TRIAL",
          priceMonthly: getEffectivePrice(currentType),
        },
      });
    }

    // 3. 新タイプのサブスクリプションを作成
    await tx.subscription.create({
      data: {
        companyId: user.companyId,
        planType: newType,
        status: "TRIAL",
        priceMonthly: getEffectivePrice(newType),
      },
    });
  });

  return { success: true, alreadyBoth: false };
}
