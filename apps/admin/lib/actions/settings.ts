"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/session";

// ---------------------------------------------------------------------------
// Admin Company
// ---------------------------------------------------------------------------

export async function getAdminCompany() {
  const admin = await requireAdminSession();
  if (!admin.adminCompanyId) return null;
  const company = await prisma.adminCompany.findUnique({
    where: { id: admin.adminCompanyId },
  });
  if (!company) return null;
  return {
    ...company,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

export async function updateAdminCompany(data: {
  name?: string;
  email?: string;
  nameKana?: string;
  invoiceNumber?: string;
  postalCode?: string;
  city?: string;
  streetAddress?: string;
  building?: string;
  telNumber?: string;
  hpUrl?: string;
  bankName?: string;
  bankBranchName?: string;
  bankAccountType?: "ORDINARY" | "CURRENT";
  bankAccountNumber?: string;
  bankAccountName?: string;
}) {
  const admin = await requireAdminSession();
  return prisma.adminCompany.update({
    where: { id: admin.adminCompanyId },
    data,
  });
}

// ---------------------------------------------------------------------------
// Admin Users
// ---------------------------------------------------------------------------

export async function getAdminUsers() {
  const admin = await requireAdminSession();
  const users = await prisma.adminUser.findMany({
    where: { adminCompanyId: admin.adminCompanyId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      lastName: true,
      firstName: true,
      email: true,
      roleId: true,
      isActive: true,
      createdAt: true,
    },
  });
  return users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function createAdminUser(data: {
  lastName: string;
  firstName: string;
  email: string;
  password: string;
  roleId?: number;
}) {
  const admin = await requireAdminSession();

  const existing = await prisma.adminUser.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("このメールアドレスは既に使用されています");

  const hashedPassword = await bcrypt.hash(data.password, 12);

  return prisma.adminUser.create({
    data: {
      lastName: data.lastName,
      firstName: data.firstName,
      email: data.email,
      password: hashedPassword,
      roleId: data.roleId ?? 1,
      adminCompanyId: admin.adminCompanyId,
      isActive: true,
    },
  });
}

export async function updateAdminUser(
  id: string,
  data: {
    lastName?: string;
    firstName?: string;
    email?: string;
    roleId?: number;
    isActive?: boolean;
  }
) {
  await requireAdminSession();
  return prisma.adminUser.update({ where: { id }, data });
}

export async function resetAdminUserPassword(id: string, newPassword: string) {
  await requireAdminSession();
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({
    where: { id },
    data: { password: hashedPassword },
  });
  return { success: true };
}

export async function deleteAdminUser(id: string) {
  await requireAdminSession();
  await prisma.adminUser.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Contract Masters
// ---------------------------------------------------------------------------

export async function getContractMasters() {
  await requireAdminSession();
  const masters = await prisma.contractMaster.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return masters.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    deletedAt: m.deletedAt?.toISOString() ?? null,
  }));
}

export async function createContractMaster(data: {
  name: string;
  type: number;
  form: string;
  numberOfAccount: number;
  price: number;
  note?: string;
}) {
  await requireAdminSession();
  return prisma.contractMaster.create({ data });
}

export async function updateContractMaster(
  id: string,
  data: { name?: string; type?: number; form?: string; numberOfAccount?: number; price?: number; note?: string }
) {
  await requireAdminSession();
  return prisma.contractMaster.update({ where: { id }, data });
}

export async function deleteContractMaster(id: string) {
  await requireAdminSession();
  return prisma.contractMaster.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Company Contracts
// ---------------------------------------------------------------------------

export async function getCompanyContracts(params?: { page?: number; perPage?: number }) {
  await requireAdminSession();

  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const [contracts, total] = await Promise.all([
    prisma.companyContract.findMany({
      where: { deletedAt: null },
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { name: true, type: true } },
      },
    }),
    prisma.companyContract.count({ where: { deletedAt: null } }),
  ]);

  return {
    contracts: contracts.map((c) => ({
      ...c,
      planPayDate: c.planPayDate?.toISOString() ?? null,
      actualPayDate: c.actualPayDate?.toISOString() ?? null,
      contractStartDate: c.contractStartDate?.toISOString() ?? null,
      contractEndDate: c.contractEndDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      deletedAt: c.deletedAt?.toISOString() ?? null,
    })),
    total,
    totalPages: Math.ceil(total / perPage),
    page,
  };
}

// ---------------------------------------------------------------------------
// Notifications (admin-created announcements)
// ---------------------------------------------------------------------------

export async function getNotifications(params?: { page?: number; perPage?: number }) {
  await requireAdminSession();

  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { deletedAt: null },
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
        createdAt: true,
        userId: true,
        user: { select: { lastName: true, firstName: true, email: true } },
      },
    }),
    prisma.notification.count({ where: { deletedAt: null } }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    totalPages: Math.ceil(total / perPage),
    page,
  };
}

export async function createNotification(data: {
  title: string;
  content: string;
  type: number;
  userId: string;
  urlRedirect?: string;
}) {
  await requireAdminSession();
  const created = await prisma.notification.create({ data });
  return { ...created, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() };
}

export async function updateNotification(
  id: string,
  data: { title?: string; content?: string; type?: number; urlRedirect?: string }
) {
  await requireAdminSession();
  return prisma.notification.update({ where: { id }, data });
}

export async function deleteNotification(id: string) {
  await requireAdminSession();
  await prisma.notification.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export async function getDashboardStats() {
  await requireAdminSession();

  const [companyCount, activeFloorCount, userCount] = await Promise.all([
    prisma.company.count({ where: { deletedAt: null } }),
    prisma.factoryFloor.count({
      where: { deletedAt: null, status: { in: ["IN_PROGRESS", "CONFIRMED", "ORDERED"] } },
    }),
    prisma.user.count({ where: { deletedAt: null } }),
  ]);

  return { companyCount, activeFloorCount, userCount };
}
