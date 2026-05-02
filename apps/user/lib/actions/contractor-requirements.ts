"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export type RequirementCheck = {
  complete: boolean;
  missing: string[];
  data: {
    workEligibility: string | null;
    workersCompInsurance: boolean | null;
    invoiceNumber: string | null;
    constructionPermit: string | null;
    socialInsurance: boolean | null;
    bankName: string | null;
    bankBranchName: string | null;
    bankAccountType: string | null;
    bankAccountNumber: string | null;
    bankAccountName: string | null;
    insuranceTypes: string[];
  };
};

/** 受注者が案件を受けるために必要な情報のチェック */
export async function checkContractorRequirements(): Promise<RequirementCheck> {
  const user = await requireSession();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      workEligibility: true,
      workersCompInsurance: true,
    },
  });

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      invoiceNumber: true,
      constructionPermit: true,
      socialInsurance: true,
      bankName: true,
      bankBranchName: true,
      bankAccountType: true,
      bankAccountNumber: true,
      bankAccountName: true,
      insurances: { select: { type: true } },
    },
  });

  if (!dbUser || !company) throw new Error("データが見つかりません");

  const missing: string[] = [];

  if (!dbUser.workEligibility) missing.push("就労資格");
  if (dbUser.workersCompInsurance == null) missing.push("労災保険の加入状況");
  if (!company.invoiceNumber) missing.push("インボイス番号");
  if (!company.constructionPermit) missing.push("建設業許可証");
  if (company.socialInsurance == null) missing.push("社会保険の加入状況");
  if (
    !company.bankName ||
    !company.bankBranchName ||
    !company.bankAccountType ||
    !company.bankAccountNumber ||
    !company.bankAccountName
  ) {
    missing.push("振込先口座情報");
  }

  return {
    complete: missing.length === 0,
    missing,
    data: {
      workEligibility: dbUser.workEligibility,
      workersCompInsurance: dbUser.workersCompInsurance,
      invoiceNumber: company.invoiceNumber,
      constructionPermit: company.constructionPermit,
      socialInsurance: company.socialInsurance,
      bankName: company.bankName,
      bankBranchName: company.bankBranchName,
      bankAccountType: company.bankAccountType,
      bankAccountNumber: company.bankAccountNumber,
      bankAccountName: company.bankAccountName,
      insuranceTypes: company.insurances.map((i) => i.type),
    },
  };
}

/** 必要情報を一括保存 */
export async function saveContractorRequirements(data: {
  workEligibility: string;
  workersCompInsurance: boolean;
  invoiceNumber: string;
  constructionPermit: string;
  socialInsurance: boolean;
  bankName: string;
  bankBranchName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankAccountName: string;
  insuranceTypes: string[];
}) {
  const user = await requireSession();

  await prisma.$transaction(async (tx) => {
    // ユーザー情報更新
    await tx.user.update({
      where: { id: user.id },
      data: {
        workEligibility: data.workEligibility as "JAPANESE_NATIONAL" | "PERMANENT_RESIDENT" | "SPECIFIED_SKILLED" | "WORK_VISA" | "OTHER",
        workersCompInsurance: data.workersCompInsurance,
      },
    });

    // 会社情報更新
    await tx.company.update({
      where: { id: user.companyId },
      data: {
        invoiceNumber: data.invoiceNumber,
        constructionPermit: data.constructionPermit as "NONE" | "MLIT_GENERAL" | "MLIT_SPECIAL" | "GOVERNOR_GENERAL" | "GOVERNOR_SPECIAL",
        socialInsurance: data.socialInsurance,
        bankName: data.bankName,
        bankBranchName: data.bankBranchName,
        bankAccountType: data.bankAccountType as "ORDINARY" | "CURRENT",
        bankAccountNumber: data.bankAccountNumber,
        bankAccountName: data.bankAccountName,
      },
    });

    // 保険情報の全置換
    await tx.companyInsurance.deleteMany({ where: { companyId: user.companyId } });
    for (const type of data.insuranceTypes) {
      await tx.companyInsurance.create({
        data: { companyId: user.companyId, type },
      });
    }
  });

  return { success: true };
}
