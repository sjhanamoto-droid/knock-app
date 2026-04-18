"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";

export async function getAllSites(params?: {
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}) {
  await requireAdminSession();

  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = { deletedAt: null };
  if (params?.status) where.status = params.status;
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search } },
      { address: { contains: params.search } },
    ];
  }

  const [sites, total] = await Promise.all([
    prisma.factoryFloor.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { name: true } },
        workCompany: { select: { name: true } },
      },
    }),
    prisma.factoryFloor.count({ where }),
  ]);

  return {
    sites,
    total,
    totalPages: Math.ceil(total / perPage),
    page,
  };
}
