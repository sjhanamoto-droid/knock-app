"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireSession } from "@/lib/session";

/** メンバー管理（作成・更新・削除）は代表者・管理者のみ許可。 */
function assertManagerOrRep(role: string) {
  if (role !== "REPRESENTATIVE" && role !== "MANAGER") {
    throw new Error("権限がありません。代表者または管理者のみ実行できます。");
  }
}

export async function getMembers() {
  const user = await requireSession();

  return prisma.user.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      lastName: true,
      firstName: true,
      lastNameKana: true,
      firstNameKana: true,
      email: true,
      role: true,
      telNumber: true,
      avatar: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function getMember(id: string) {
  const user = await requireSession();

  return prisma.user.findFirst({
    where: {
      id,
      companyId: user.companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      lastName: true,
      firstName: true,
      lastNameKana: true,
      firstNameKana: true,
      email: true,
      role: true,
      telNumber: true,
      dateOfBirth: true,
      avatar: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function createMember(data: {
  lastName: string;
  firstName: string;
  lastNameKana?: string;
  firstNameKana?: string;
  email: string;
  password: string;
  telNumber?: string;
  dateOfBirth?: string;
  role?: "REPRESENTATIVE" | "MANAGER" | "OTHER";
}) {
  const user = await requireSession();
  assertManagerOrRep(user.role);
  // 代表者(REPRESENTATIVE)権限の付与は代表者のみ可能。
  if ((data.role ?? "OTHER") === "REPRESENTATIVE" && user.role !== "REPRESENTATIVE") {
    throw new Error("代表者権限の付与は代表者のみ可能です");
  }

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) throw new Error("このメールアドレスは既に使用されています");

  const hashedPassword = await bcrypt.hash(data.password, 12);

  return prisma.user.create({
    data: {
      lastName: data.lastName,
      firstName: data.firstName,
      lastNameKana: data.lastNameKana,
      firstNameKana: data.firstNameKana,
      email: data.email,
      password: hashedPassword,
      telNumber: data.telNumber,
      dateOfBirth: data.dateOfBirth,
      role: data.role ?? "OTHER",
      companyId: user.companyId,
      isActive: true,
    },
  });
}

export async function updateMember(
  id: string,
  data: {
    lastName?: string;
    firstName?: string;
    lastNameKana?: string;
    firstNameKana?: string;
    email?: string;
    telNumber?: string;
    dateOfBirth?: string;
    role?: "REPRESENTATIVE" | "MANAGER" | "OTHER";
    isActive?: boolean;
  }
) {
  const user = await requireSession();
  assertManagerOrRep(user.role);

  const member = await prisma.user.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!member) throw new Error("メンバーが見つかりません");

  // 代表者(REPRESENTATIVE)への昇格は代表者のみ可能。
  if (
    data.role === "REPRESENTATIVE" &&
    member.role !== "REPRESENTATIVE" &&
    user.role !== "REPRESENTATIVE"
  ) {
    throw new Error("代表者権限の付与は代表者のみ可能です");
  }

  // 最後の代表者を降格することはできない。
  if (member.role === "REPRESENTATIVE" && data.role && data.role !== "REPRESENTATIVE") {
    const otherReps = await prisma.user.count({
      where: { companyId: user.companyId, role: "REPRESENTATIVE", deletedAt: null, id: { not: id } },
    });
    if (otherReps === 0) throw new Error("最後の代表者を降格することはできません。先に別のメンバーを代表者にしてください。");
  }

  return prisma.user.update({
    where: { id },
    data,
  });
}

export async function deleteMember(id: string) {
  const user = await requireSession();
  assertManagerOrRep(user.role);

  const member = await prisma.user.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!member) throw new Error("メンバーが見つかりません");

  if (member.id === user.id) throw new Error("自分自身を削除することはできません");
  if (member.role === "REPRESENTATIVE") throw new Error("代表者は削除できません。先に別のメンバーへ代表者を引き継いでください。");

  return prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
