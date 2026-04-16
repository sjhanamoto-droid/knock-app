"use server";

import { prisma } from "@knock/db";
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
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      company: {
        select: {
          id: true,
          name: true,
          nameKana: true,
          type: true,
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
}) {
  const user = await requireSession();

  // 代表者・管理者のみ許可
  if (user.role !== "REPRESENTATIVE" && user.role !== "MANAGER") {
    throw new Error("権限がありません");
  }

  const updated = await prisma.company.update({
    where: { id: user.companyId },
    data,
  });

  return {
    ...updated,
    contractApprovedDate: updated.contractApprovedDate?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    deletedAt: updated.deletedAt?.toISOString() ?? null,
  };
}
