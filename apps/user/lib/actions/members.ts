"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireSession } from "@/lib/session";

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

  const member = await prisma.user.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!member) throw new Error("メンバーが見つかりません");

  return prisma.user.update({
    where: { id },
    data,
  });
}

export async function deleteMember(id: string) {
  const user = await requireSession();

  const member = await prisma.user.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!member) throw new Error("メンバーが見つかりません");

  if (member.id === user.id) throw new Error("自分自身を削除することはできません");

  return prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
