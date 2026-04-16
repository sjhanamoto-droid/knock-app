"use server";

import { auth } from "@/auth";
import { prisma } from "@knock/db";

/**
 * モード切り替えのバリデーション。
 * 実際のセッション更新はクライアント側で useSession().update({ activeMode }) を呼ぶ。
 * jwt callback (auth.config.ts) が companyType === "BOTH" を検証して token を更新する。
 */
export async function validateSwitchMode(mode: "ORDERER" | "CONTRACTOR") {
  const session = await auth();
  if (!session?.user) {
    return { error: "認証されていません" };
  }

  const companyType = (session as unknown as Record<string, unknown>).companyType;
  if (companyType !== "BOTH") {
    return { error: "モード切り替えは両方のタイプを持つ会社のみ利用可能です" };
  }

  return { success: true, activeMode: mode };
}
