"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function getCompanies(params?: {
  search?: string;
  type?: string;
  isActive?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  await requireAdminSession();

  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = { deletedAt: null };
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search } },
      { email: { contains: params.search } },
    ];
  }
  if (params?.type) {
    where.type = params.type;
  }
  if (params?.isActive === "true") {
    where.isActive = true;
  } else if (params?.isActive === "false") {
    where.isActive = false;
  }

  const sortBy = params?.sortBy ?? "createdAt";
  const sortOrder = params?.sortOrder ?? "desc";
  const orderBy = { [sortBy]: sortOrder };

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take: perPage,
      orderBy,
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        companyForm: true,
        telNumber: true,
        isActive: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    }),
    prisma.company.count({ where }),
  ]);

  return {
    companies: companies.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    total,
    totalPages: Math.ceil(total / perPage),
    page,
  };
}

export async function getCompany(id: string) {
  await requireAdminSession();

  const company = await prisma.company.findFirst({
    where: { id, deletedAt: null },
    include: {
      users: {
        where: { deletedAt: null },
        select: {
          id: true,
          lastName: true,
          firstName: true,
          lastNameKana: true,
          firstNameKana: true,
          email: true,
          telNumber: true,
          dateOfBirth: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      },
      contracts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      areas: {
        include: { area: true },
      },
      occupations: {
        include: {
          occupationSubItem: {
            include: {
              occupationMajorItem: true,
            },
          },
        },
      },
    },
  });

  if (!company) return null;

  return {
    ...company,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
    deletedAt: company.deletedAt?.toISOString() ?? null,
    contractApprovedDate: company.contractApprovedDate?.toISOString() ?? null,
    users: company.users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
    contracts: company.contracts.map((c) => ({
      ...c,
      planPayDate: c.planPayDate?.toISOString() ?? null,
      actualPayDate: c.actualPayDate?.toISOString() ?? null,
      contractStartDate: c.contractStartDate?.toISOString() ?? null,
      contractEndDate: c.contractEndDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      deletedAt: c.deletedAt?.toISOString() ?? null,
    })),
    occupations: company.occupations.map((o) => ({
      id: o.id,
      occupationSubItemId: o.occupationSubItemId,
      note: o.note,
      subItemName: o.occupationSubItem.name,
      majorItemName: o.occupationSubItem.occupationMajorItem.name,
    })),
  };
}

export async function createCompany(data: {
  name: string;
  email: string;
  type: "ORDERER" | "CONTRACTOR" | "BOTH";
  companyForm: "CORPORATION" | "INDIVIDUAL";
  nameKana?: string;
  postalCode?: string;
  city?: string;
  streetAddress?: string;
  building?: string;
  telNumber?: string;
}) {
  const admin = await requireAdminSession();

  return prisma.company.create({
    data: {
      ...data,
      adminCompanyId: admin.adminCompanyId,
      isActive: true,
    },
  });
}

export async function updateCompany(
  id: string,
  data: {
    name?: string;
    email?: string;
    nameKana?: string;
    type?: "ORDERER" | "CONTRACTOR" | "BOTH";
    companyForm?: "CORPORATION" | "INDIVIDUAL";
    postalCode?: string;
    prefecture?: string;
    city?: string;
    streetAddress?: string;
    building?: string;
    telNumber?: string;
    hpUrl?: string;
    invoiceNumber?: string;
    isActive?: boolean;
  }
) {
  await requireAdminSession();

  const updated = await prisma.company.update({
    where: { id },
    data,
  });

  return { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() };
}

export async function updateUser(
  userId: string,
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
  await requireAdminSession();

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      lastName: true,
      firstName: true,
      lastNameKana: true,
      firstNameKana: true,
      email: true,
      telNumber: true,
      dateOfBirth: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return { ...updated, createdAt: updated.createdAt.toISOString() };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requireAdminSession();

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { success: true };
}

export async function deleteCompany(id: string) {
  await requireAdminSession();

  return prisma.company.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function getOccupationMasters() {
  await requireAdminSession();

  const majors = await prisma.occupationMajorItem.findMany({
    include: {
      subItems: {
        select: { id: true, name: true },
      },
    },
    orderBy: { id: "asc" },
  });

  return majors.map((m) => ({
    id: m.id,
    name: m.name,
    subItems: m.subItems,
  }));
}

export async function getCompanyOccupations(companyId: string) {
  await requireAdminSession();

  const occupations = await prisma.companyOccupation.findMany({
    where: { companyId },
    select: {
      id: true,
      occupationSubItemId: true,
      note: true,
    },
  });

  return occupations;
}

export async function saveCompanyOccupations(
  companyId: string,
  selections: { occupationSubItemId: string; note?: string }[]
) {
  await requireAdminSession();

  await prisma.companyOccupation.deleteMany({
    where: { companyId },
  });

  if (selections.length > 0) {
    await prisma.companyOccupation.createMany({
      data: selections.map((s) => ({
        companyId,
        occupationSubItemId: s.occupationSubItemId,
        note: s.note || null,
      })),
    });
  }

  return { success: true };
}
