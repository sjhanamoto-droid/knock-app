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
  const admin = await requireAdminSession();

  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = { deletedAt: null, adminCompanyId: admin.adminCompanyId };
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
        isHidden: true,
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
          lastLoginAt: true,
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
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
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
  // 初期ユーザー情報
  userLastName?: string;
  userFirstName?: string;
  userEmail?: string;
  userPassword?: string;
}) {
  const admin = await requireAdminSession();

  const {
    userLastName, userFirstName, userEmail, userPassword,
    ...companyData
  } = data;

  const company = await prisma.company.create({
    data: {
      ...companyData,
      adminCompanyId: admin.adminCompanyId,
      isActive: true,
    },
  });

  // 初期ユーザーを同時作成
  if (userLastName && userFirstName && userEmail && userPassword) {
    const hashedPassword = await bcrypt.hash(userPassword, 12);
    await prisma.user.create({
      data: {
        companyId: company.id,
        lastName: userLastName,
        firstName: userFirstName,
        email: userEmail,
        password: hashedPassword,
        role: "REPRESENTATIVE",
        isActive: true,
        policyStatus: true,
      },
    });
  }

  return company;
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
    isHidden?: boolean;
  }
) {
  const admin = await requireAdminSession();

  const target = await prisma.company.findUnique({
    where: { id },
    select: { adminCompanyId: true },
  });
  if (!target || target.adminCompanyId !== admin.adminCompanyId) {
    throw new Error("権限がありません");
  }

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
  const admin = await requireAdminSession();

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { company: { select: { adminCompanyId: true } } },
  });
  if (!targetUser?.company || targetUser.company.adminCompanyId !== admin.adminCompanyId) {
    throw new Error("権限がありません");
  }

  // メールアドレス重複チェック（別ユーザーが同じメールを使用している場合はエラーを返す）
  if (data.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      return { error: "EMAIL_TAKEN" as const };
    }
  }

  try {
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
        lastLoginAt: true,
      },
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
    };
  } catch (err) {
    // 同時実行などで pre-check をすり抜けたユニーク制約違反(P2002)の保険
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return { error: "EMAIL_TAKEN" as const };
    }
    throw err;
  }
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const admin = await requireAdminSession();

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { company: { select: { adminCompanyId: true } } },
  });
  if (!targetUser?.company || targetUser.company.adminCompanyId !== admin.adminCompanyId) {
    throw new Error("権限がありません");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { success: true };
}

export async function createUser(
  companyId: string,
  data: {
    lastName: string;
    firstName: string;
    email: string;
    password: string;
    role?: "REPRESENTATIVE" | "MANAGER" | "OTHER";
    lastNameKana?: string;
    firstNameKana?: string;
    telNumber?: string;
    dateOfBirth?: string;
  }
) {
  await requireAdminSession();

  // メールアドレス重複チェック（既存ユーザーと同じメールでは作成できない）
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existing) {
    return { error: "EMAIL_TAKEN" as const };
  }

  const hashedPassword = await bcrypt.hash(data.password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        companyId,
        lastName: data.lastName,
        firstName: data.firstName,
        lastNameKana: data.lastNameKana || null,
        firstNameKana: data.firstNameKana || null,
        email: data.email,
        password: hashedPassword,
        telNumber: data.telNumber || null,
        dateOfBirth: data.dateOfBirth || null,
        role: data.role ?? "OTHER",
        isActive: true,
        policyStatus: true,
      },
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
        lastLoginAt: true,
      },
    });

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  } catch (err) {
    // ユニーク制約違反(P2002)の保険
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return { error: "EMAIL_TAKEN" as const };
    }
    throw err;
  }
}

export async function deleteCompany(id: string) {
  const admin = await requireAdminSession();

  const target = await prisma.company.findUnique({
    where: { id },
    select: { adminCompanyId: true },
  });
  if (!target || target.adminCompanyId !== admin.adminCompanyId) {
    throw new Error("権限がありません");
  }

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
