"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { DEFAULT_TEMPLATES, getEffectivePrice } from "@knock/utils";
import { PROXY_INITIAL_PASSWORD } from "@/lib/proxy-registration-constants";

const required = (label: string) => z.string().trim().min(1, `${label}を入力してください`);

const proxyRegistrationSchema = z.object({
  type: z.enum(["ORDERER", "CONTRACTOR"]),
  loginEmail: z.string().trim().email("ログイン用メールアドレスが正しくありません"),
  companyForm: z.enum(["CORPORATION", "INDIVIDUAL"], { message: "事業形態を選択してください" }),
  businessName: required("事業者名"),
  nameKana: required("会社フリガナ"),
  postalCode: required("郵便番号"),
  prefecture: required("都道府県"),
  city: required("市区町村"),
  streetAddress: required("番地"),
  building: z.string().trim(),
  companyTel: required("電話番号（会社）"),
  invoiceDigits: z.string().trim().regex(/^(\d{13})?$/, "インボイス登録番号はTを除く13桁の数字で入力してください"),
  lastName: required("姓"),
  firstName: required("名"),
  lastNameKana: required("セイ"),
  firstNameKana: required("メイ"),
  birthYear: z.string().regex(/^\d{4}$/, "生年月日の年は西暦4桁で入力してください"),
  birthMonth: z.string().regex(/^(0?[1-9]|1[0-2])$/, "生年月日の月は1〜12で入力してください"),
  birthDay: z.string().regex(/^(0?[1-9]|[12]\d|3[01])$/, "生年月日の日は1〜31で入力してください"),
  personTel: required("電話番号（担当者）"),
  bankName: z.string().trim(),
  bankBranchName: z.string().trim(),
  bankAccountType: z.enum(["ORDINARY", "CURRENT", ""]),
  bankAccountNumber: z.string().trim(),
  bankAccountName: z.string().trim(),
  occupationSubItemIds: z.array(z.string()),
});

export type ProxyRegistrationInput = z.input<typeof proxyRegistrationSchema>;

/**
 * 運営による代理登録（仮登録）。
 * ユーザー自身の新規登録（利用規約同意→3ステップ）完了時と同じ状態を一度に作る:
 * 会社・代表者ユーザー・無料トライアルのサブスク・デフォルト定型文・対応職種。
 * パスワードは固定の初期値。利用規約への同意はメール返信で取得済みの前提。
 */
export async function proxyRegisterCompany(input: ProxyRegistrationInput) {
  const admin = await requireAdminSession();

  const parsed = proxyRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("\n") };
  }
  const d = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email: d.loginEmail },
    select: { id: true },
  });
  if (existing) {
    return { error: "このメールアドレスは既に登録されています" };
  }

  const hashedPassword = await bcrypt.hash(PROXY_INITIAL_PASSWORD, 12);
  const dateOfBirth = `${d.birthYear}-${d.birthMonth.padStart(2, "0")}-${d.birthDay.padStart(2, "0")}`;

  try {
    const company = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          type: d.type,
          adminCompanyId: admin.adminCompanyId,
          companyForm: d.companyForm,
          name: d.businessName,
          nameKana: d.nameKana,
          email: d.loginEmail,
          postalCode: d.postalCode,
          prefecture: d.prefecture,
          city: d.city,
          streetAddress: d.streetAddress,
          building: d.building || null,
          telNumber: d.companyTel,
          invoiceNumber: d.invoiceDigits ? `T${d.invoiceDigits}` : null,
          bankName: d.bankName || null,
          bankBranchName: d.bankBranchName || null,
          bankAccountType: d.bankAccountType || null,
          bankAccountNumber: d.bankAccountNumber || null,
          bankAccountName: d.bankAccountName || null,
          isActive: true,
          registrationStep: null,
        },
      });

      await tx.user.create({
        data: {
          companyId: company.id,
          email: d.loginEmail,
          password: hashedPassword,
          lastName: d.lastName,
          firstName: d.firstName,
          lastNameKana: d.lastNameKana,
          firstNameKana: d.firstNameKana,
          dateOfBirth,
          telNumber: d.personTel,
          role: "REPRESENTATIVE",
          isActive: true,
          policyStatus: true,
        },
      });

      await tx.subscription.create({
        data: {
          companyId: company.id,
          planType: d.type,
          status: "TRIAL",
          priceMonthly: getEffectivePrice(d.type),
        },
      });

      await tx.templateMessage.createMany({
        data: DEFAULT_TEMPLATES.map((t) => ({ name: t.name, content: t.content, companyId: company.id })),
      });

      if (d.occupationSubItemIds.length > 0) {
        await tx.companyOccupation.createMany({
          data: d.occupationSubItemIds.map((id) => ({ companyId: company.id, occupationSubItemId: id })),
        });
      }

      return company;
    });

    return {
      success: true as const,
      companyId: company.id,
      loginEmail: d.loginEmail,
      password: PROXY_INITIAL_PASSWORD,
    };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      return { error: "このメールアドレスは既に登録されています" };
    }
    console.error("[proxyRegisterCompany] Error:", err);
    return { error: "登録に失敗しました。もう一度お試しください。" };
  }
}

/** 会社のユーザーごとに、パスワードが代理登録時の初期値のままかを返す（userId → true=未変更） */
export async function getInitialPasswordStatus(companyId: string): Promise<Record<string, boolean>> {
  const admin = await requireAdminSession();

  const users = await prisma.user.findMany({
    where: { companyId, deletedAt: null, company: { adminCompanyId: admin.adminCompanyId } },
    select: { id: true, password: true },
  });

  const entries = await Promise.all(
    users.map(async (u) => [u.id, await bcrypt.compare(PROXY_INITIAL_PASSWORD, u.password)] as const)
  );
  return Object.fromEntries(entries);
}
