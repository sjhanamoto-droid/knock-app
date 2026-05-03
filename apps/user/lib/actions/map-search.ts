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

/**
 * 地図表示用: 緯度経度付き協力会社（受注者）を検索する（発注者）
 */
export async function searchContractorsWithLocation(filters?: {
  keyword?: string;
  prefecture?: string;
}) {
  const user = await requireSession();

  const where: Record<string, unknown> = {
    type: { in: ["CONTRACTOR", "BOTH"] },
    isActive: true,
    deletedAt: null,
    id: { not: user.companyId },
    latitude: { not: null },
    longitude: { not: null },
  };

  if (filters?.keyword?.trim()) {
    where.name = { contains: filters.keyword.trim(), mode: "insensitive" };
  }

  if (filters?.prefecture) {
    where.prefecture = filters.prefecture;
  }

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: "asc" },
    take: 200,
    select: {
      id: true,
      name: true,
      logo: true,
      prefecture: true,
      city: true,
      latitude: true,
      longitude: true,
      occupations: {
        include: {
          occupationSubItem: { select: { name: true } },
        },
      },
    },
  });

  // 接続状態を取得（contractors.ts の searchContractors と同様のロジック）
  const [matchings, inviteds] = await Promise.all([
    prisma.matching.findMany({
      where: {
        deletedAt: null,
        OR: [
          { inviteCompanyId: user.companyId },
          { beInviteCompanyId: user.companyId },
        ],
      },
      select: { inviteCompanyId: true, beInviteCompanyId: true },
    }),
    prisma.invited.findMany({
      where: {
        deletedAt: null,
        OR: [
          { inviteCompanyId: user.companyId },
          { invitedCompanyId: user.companyId },
        ],
      },
      select: { inviteCompanyId: true, invitedCompanyId: true },
    }),
  ]);

  const connectedIds = new Set(
    matchings.map((m) =>
      m.inviteCompanyId === user.companyId ? m.beInviteCompanyId : m.inviteCompanyId
    )
  );
  const pendingIds = new Set(
    inviteds.map((i) =>
      i.inviteCompanyId === user.companyId ? i.invitedCompanyId : i.inviteCompanyId
    )
  );

  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    logo: c.logo,
    prefecture: c.prefecture,
    city: c.city,
    latitude: Number(c.latitude),
    longitude: Number(c.longitude),
    connectionStatus: connectedIds.has(c.id)
      ? ("connected" as const)
      : pendingIds.has(c.id)
        ? ("pending" as const)
        : ("none" as const),
    occupationNames: c.occupations.map((o) => o.occupationSubItem.name).slice(0, 3),
  }));
}
