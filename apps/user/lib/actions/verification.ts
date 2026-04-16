"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

/**
 * ユーザーのKYCステータスを取得
 * registrationStep === null → 登録完了 (Level 2+)
 * registrationStep === 1,2,3 → 登録途中 (Level 1)
 */
export async function getVerificationStatus() {
  const user = await requireSession();

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      registrationStep: true,
      isActive: true,
      name: true,
    },
  });

  if (!company) throw new Error("会社情報が見つかりません");

  const isKycComplete = company.registrationStep === null && company.isActive;

  return {
    isKycComplete,
    registrationStep: company.registrationStep,
    companyName: company.name,
  };
}

/**
 * Level 2 ガード: KYC未完了の場合はエラーを投げる
 */
export async function requireKyc() {
  const status = await getVerificationStatus();
  if (!status.isKycComplete) {
    throw new Error(
      "この操作を行うには会社情報と個人情報の登録が必要です。設定画面から登録を完了してください。"
    );
  }
  return status;
}
