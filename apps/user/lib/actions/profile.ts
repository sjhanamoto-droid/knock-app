"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireSession } from "@/lib/session";

export async function getProfile() {
  const user = await requireSession();

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      lastName: true,
      firstName: true,
      lastNameKana: true,
      firstNameKana: true,
      email: true,
      dateOfBirth: true,
      role: true,
      telNumber: true,
      avatar: true,
      companyId: true,
      policyStatus: true,
      isActive: true,
      // プロフィール強化
      gender: true,
      workEligibility: true,
      tradeName: true,
      workersCompInsurance: true,
      bio: true,
      qualifications: {
        select: {
          qualification: { select: { id: true, name: true, category: true } },
        },
      },
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      company: {
        select: {
          id: true,
          name: true,
          nameKana: true,
          type: true,
          companyForm: true,
          email: true,
          telNumber: true,
          postalCode: true,
          prefecture: true,
          city: true,
          streetAddress: true,
          building: true,
          hpUrl: true,
          invoiceNumber: true,
          logo: true,
          stampImage: true,
          bankName: true,
          bankBranchName: true,
          bankAccountType: true,
          bankAccountNumber: true,
          bankAccountName: true,
          // プロフィール強化
          workforceCapacity: true,
          constructionPermit: true,
          invoiceRegistration: true,
          socialInsurance: true,
          // 請求設定
          billingClosingDay: true,
          billingGraceDays: true,
          paymentDueType: true,
          registrationStep: true,
          insurances: { select: { type: true } },
          areas: {
            select: { area: { select: { id: true, name: true } } },
          },
          occupations: {
            select: {
              occupationSubItem: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  });
  if (!profile) return null;

  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    deletedAt: profile.deletedAt?.toISOString() ?? null,
  };
}

export async function updateProfile(data: {
  lastName?: string;
  firstName?: string;
  lastNameKana?: string;
  firstNameKana?: string;
  telNumber?: string;
  dateOfBirth?: string;
  email?: string;
  gender?: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED" | null;
  workEligibility?: "JAPANESE_NATIONAL" | "PERMANENT_RESIDENT" | "SPECIFIED_SKILLED" | "WORK_VISA" | "OTHER" | null;
  tradeName?: string | null;
  workersCompInsurance?: boolean | null;
  bio?: string | null;
}) {
  const user = await requireSession();

  // メールアドレス変更時は重複チェック
  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing && existing.id !== user.id) {
      throw new Error("このメールアドレスは既に使用されています");
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      lastName: true,
      firstName: true,
      lastNameKana: true,
      firstNameKana: true,
      email: true,
      dateOfBirth: true,
      telNumber: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  });

  // registrationStep が 2 の場合、個人情報保存で登録完了
  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { registrationStep: true },
  });

  if (company?.registrationStep === 2) {
    await prisma.company.update({
      where: { id: user.companyId },
      data: { registrationStep: null, isActive: true },
    });
  }

  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    deletedAt: updated.deletedAt?.toISOString() ?? null,
  };
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const user = await requireSession();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  if (!dbUser) throw new Error("ユーザーが見つかりません");

  const isValid = await bcrypt.compare(data.currentPassword, dbUser.password);
  if (!isValid) {
    throw new Error("現在のパスワードが正しくありません");
  }

  if (data.newPassword.length < 6) {
    throw new Error("新しいパスワードは6文字以上で入力してください");
  }

  const hashedPassword = await bcrypt.hash(data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return { success: true };
}

export async function checkBankInfo(): Promise<{
  complete: boolean;
  bankName: string | null;
  bankBranchName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
}> {
  const user = await requireSession();
  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: {
      bankName: true,
      bankBranchName: true,
      bankAccountType: true,
      bankAccountNumber: true,
      bankAccountName: true,
    },
  });
  if (!company) throw new Error("会社情報が見つかりません");

  const complete = !!(
    company.bankName &&
    company.bankBranchName &&
    company.bankAccountType &&
    company.bankAccountNumber &&
    company.bankAccountName
  );

  return {
    complete,
    bankName: company.bankName,
    bankBranchName: company.bankBranchName,
    bankAccountType: company.bankAccountType,
    bankAccountNumber: company.bankAccountNumber,
    bankAccountName: company.bankAccountName,
  };
}

export async function updateAvatar(avatarDataUrl: string | null) {
  const user = await requireSession();

  await prisma.user.update({
    where: { id: user.id },
    data: { avatar: avatarDataUrl },
  });

  return { success: true };
}

export async function updateCompany(data: {
  name?: string;
  nameKana?: string;
  email?: string;
  telNumber?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  streetAddress?: string;
  building?: string;
  hpUrl?: string;
  invoiceNumber?: string;
  stampImage?: string | null;
  bankName?: string;
  bankBranchName?: string;
  bankAccountType?: "ORDINARY" | "CURRENT";
  bankAccountNumber?: string;
  bankAccountName?: string;
  companyForm?: "CORPORATION" | "INDIVIDUAL" | null;
  workforceCapacity?: "ONE" | "TWO_TO_TEN" | "ELEVEN_TO_THIRTY" | "THIRTY_ONE_TO_FIFTY" | "FIFTY_PLUS" | null;
  constructionPermit?: "NONE" | "MLIT_GENERAL" | "MLIT_SPECIAL" | "GOVERNOR_GENERAL" | "GOVERNOR_SPECIAL" | null;
  invoiceRegistration?: "NOT_ENTERED" | "NOT_REGISTERED" | "REGISTERED" | null;
  socialInsurance?: boolean | null;
  // 請求設定
  billingClosingDay?: number | null;
  billingGraceDays?: number | null;
  paymentDueType?: "NEXT_MONTH_END" | "NEXT_MONTH_25" | "NEXT_MONTH_20" | "NEXT_MONTH_15" | "TWO_MONTHS_END" | null;
}) {
  const user = await requireSession();

  // registrationStep が 1 の場合、会社情報保存で次のステップへ進める
  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { registrationStep: true },
  });

  const updateData: Record<string, unknown> = { ...data };
  if (company?.registrationStep === 1) {
    updateData.registrationStep = 2;
  }

  // Geocoding: address fields が含まれる場合は緯度経度を取得する
  if (data.prefecture || data.city || data.streetAddress) {
    try {
      // 現在の住所と新しい値をマージして完全な住所を構築
      const currentCompany = await prisma.company.findUnique({
        where: { id: user.companyId },
        select: { prefecture: true, city: true, streetAddress: true },
      });
      const prefecture = data.prefecture ?? currentCompany?.prefecture ?? "";
      const city = data.city ?? currentCompany?.city ?? "";
      const streetAddress = data.streetAddress ?? currentCompany?.streetAddress ?? "";
      const query = `${prefecture}${city}${streetAddress}`;

      if (query.trim()) {
        const geoRes = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&country=jp&limit=1`
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.features && geoData.features.length > 0) {
            const [lng, lat] = geoData.features[0].center;
            updateData.longitude = lng;
            updateData.latitude = lat;
          }
        }
      }
    } catch {
      // ジオコーディング失敗時は座標を設定しない（保存は継続）
    }
  }

  const updated = await prisma.company.update({
    where: { id: user.companyId },
    data: updateData,
  });

  return {
    ...updated,
    contractApprovedDate: updated.contractApprovedDate?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    deletedAt: updated.deletedAt?.toISOString() ?? null,
  };
}

// ============ プロフィール強化: 資格・保険 ============

export async function getQualificationMasters() {
  const masters = await prisma.qualificationMaster.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, category: true },
  });
  return masters;
}

export async function saveUserQualifications(qualificationIds: string[]) {
  const user = await requireSession();

  // 全置換: 既存を削除して新規作成
  await prisma.$transaction([
    prisma.userQualification.deleteMany({ where: { userId: user.id } }),
    ...qualificationIds.map((qId) =>
      prisma.userQualification.create({
        data: { userId: user.id, qualificationId: qId },
      })
    ),
  ]);

  return { success: true };
}

export async function saveCompanyAreas(areaIds: string[]) {
  const user = await requireSession();

  if (user.role !== "REPRESENTATIVE" && user.role !== "MANAGER") {
    throw new Error("権限がありません");
  }

  await prisma.$transaction([
    prisma.companyArea.deleteMany({ where: { companyId: user.companyId } }),
    ...areaIds.map((areaId) =>
      prisma.companyArea.create({
        data: { companyId: user.companyId, areaId },
      })
    ),
  ]);

  return { success: true };
}

export async function saveCompanyInsurances(types: string[]) {
  const user = await requireSession();

  if (user.role !== "REPRESENTATIVE" && user.role !== "MANAGER") {
    throw new Error("権限がありません");
  }

  // 全置換: 既存を削除して新規作成
  await prisma.$transaction([
    prisma.companyInsurance.deleteMany({ where: { companyId: user.companyId } }),
    ...types.map((type) =>
      prisma.companyInsurance.create({
        data: { companyId: user.companyId, type },
      })
    ),
  ]);

  return { success: true };
}
