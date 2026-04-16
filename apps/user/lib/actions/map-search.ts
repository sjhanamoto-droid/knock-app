"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

/**
 * 地図表示用: 緯度経度付き案件を検索する（受注者）
 */
export async function searchJobsWithLocation(filters?: {
  occupationSubItemId?: string;
  keyword?: string;
  prefecture?: string;
}) {
  const user = await requireSession();

  const where: Record<string, unknown> = {
    status: "PUBLISHED",
    deletedAt: null,
    companyId: { not: user.companyId },
    factoryFloor: {
      latitude: { not: null },
      longitude: { not: null },
    },
  };

  if (filters?.occupationSubItemId) {
    where.occupationSubItemId = filters.occupationSubItemId;
  }

  if (filters?.keyword) {
    where.OR = [
      { title: { contains: filters.keyword, mode: "insensitive" } },
      { description: { contains: filters.keyword, mode: "insensitive" } },
    ];
  }

  if (filters?.prefecture) {
    where.address = { contains: filters.prefecture, mode: "insensitive" };
  }

  const jobs = await prisma.jobPosting.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logo: true,
        },
      },
      occupationSubItem: { select: { name: true } },
      factoryFloor: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  return jobs
    .filter(
      (job) =>
        job.factoryFloor?.latitude != null &&
        job.factoryFloor?.longitude != null
    )
    .map((job) => ({
      id: job.id,
      title: job.title,
      companyId: job.company.id,
      companyName: job.company.name,
      companyLogo: job.company.logo,
      compensationType: job.compensationType,
      compensationAmount: job.compensationAmount
        ? Number(job.compensationAmount)
        : null,
      occupationName: job.occupationSubItem?.name ?? null,
      latitude: Number(job.factoryFloor!.latitude),
      longitude: Number(job.factoryFloor!.longitude),
    }));
}
