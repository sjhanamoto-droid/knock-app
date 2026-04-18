"use server";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { getEffectivePrice } from "@knock/utils";
import { createDefaultTemplates } from "@/lib/actions/templates";

export async function registerStep1(
  data: { email: string; password: string },
  type: "ORDERER" | "CONTRACTOR"
) {
  try {
    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      include: { company: true },
    });

    if (existingUser) {
      // 登録完了済みのユーザーは再登録不可
      if (existingUser.isActive) {
        return { error: "このメールアドレスは既に登録されています" };
      }

      // 登録未完了のユーザー → パスワード更新して登録を再開
      const hashedPassword = await bcrypt.hash(data.password, 12);
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existingUser.id },
          data: { password: hashedPassword },
        });
        await tx.company.update({
          where: { id: existingUser.companyId },
          data: { type, registrationStep: 1 },
        });
      });

      return { success: true, companyId: existingUser.companyId };
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(data.password, 12);

    const adminCompanyId =
      process.env.DEFAULT_ADMIN_COMPANY_ID ?? "default-admin-company-id";

    // トランザクションで Company + User を同時作成
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          type: type,
          adminCompanyId: adminCompanyId,
          registrationStep: 1,
          isActive: false,
        },
      });

      await tx.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          lastName: "",
          firstName: "",
          companyId: company.id,
          isActive: true, // Level 1: 即ログイン可能
        },
      });

      return company;
    });

    return { success: true, companyId: result.id };
  } catch (error) {
    console.error("[Registration Step1] Error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return { error: `登録に失敗しました: ${detail}` };
  }
}

export async function registerStep2(
  companyId: string,
  data: {
    companyForm: string;
    businessName: string;
    nameKana: string;
    postalCode: string;
    prefecture: string;
    city: string;
    streetAddress: string;
    building?: string;
    telNumber: string;
    invoiceNumber?: string;
  }
) {
  try {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        companyForm: data.companyForm as "CORPORATION" | "INDIVIDUAL",
        name: data.businessName,
        nameKana: data.nameKana,
        postalCode: data.postalCode,
        prefecture: data.prefecture,
        city: data.city,
        streetAddress: data.streetAddress,
        building: data.building,
        telNumber: data.telNumber,
        invoiceNumber: data.invoiceNumber,
        registrationStep: 2,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[Registration Step2] Error:", error);
    return { error: "会社情報の登録に失敗しました。もう一度お試しください。" };
  }
}

export async function registerStep3(
  companyId: string,
  data: {
    lastName: string;
    firstName: string;
    lastNameKana: string;
    firstNameKana: string;
    dateOfBirth: string;
    telPhone: string;
  },
  credentials: { email: string; password: string }
) {
  try {
    // Company に紐づくユーザーを取得（Level 1でisActive: trueに変更済み）
    const user = await prisma.user.findFirst({
      where: {
        companyId: companyId,
      },
    });

    if (!user) {
      return { error: "対象のユーザーが見つかりません" };
    }

    // トランザクションで User と Company を同時更新 + サブスクリプション作成
    await prisma.$transaction(async (tx) => {
      // User を更新: 個人情報 + role + isActive
      await tx.user.update({
        where: { id: user.id },
        data: {
          lastName: data.lastName,
          firstName: data.firstName,
          lastNameKana: data.lastNameKana,
          firstNameKana: data.firstNameKana,
          dateOfBirth: data.dateOfBirth,
          telNumber: data.telPhone,
          role: "REPRESENTATIVE",
          isActive: true,
        },
      });

      // Company を更新: 登録完了
      const company = await tx.company.update({
        where: { id: companyId },
        data: {
          isActive: true,
          registrationStep: null,
        },
      });

      // サブスクリプションを作成（無料トライアル）
      const planType = company.type === "BOTH" ? "CONTRACTOR" : company.type;
      await tx.subscription.create({
        data: {
          companyId,
          planType: planType as "CONTRACTOR" | "ORDERER",
          status: "TRIAL",
          priceMonthly: getEffectivePrice(planType as "CONTRACTOR" | "ORDERER"),
        },
      });

      // BOTH の場合は両方のサブスクリプションを作成
      if (company.type === "BOTH") {
        await tx.subscription.create({
          data: {
            companyId,
            planType: "ORDERER",
            status: "TRIAL",
            priceMonthly: getEffectivePrice("ORDERER"),
          },
        });
      }
    });

    // デフォルトテンプレートを作成（非同期・エラー無視）
    void createDefaultTemplates(companyId);

    // 登録完了後、自動ログインしてオンボーディングへリダイレクト
    await signIn("credentials", {
      email: credentials.email,
      password: credentials.password,
      redirectTo: "/onboarding",
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      console.error("[Registration Step3] Auth error:", error);
      return {
        error: "登録は完了しましたが、自動ログインに失敗しました。ログインページからログインしてください。",
      };
    }
    // signIn成功時のリダイレクトは再throwする
    throw error;
  }
}
