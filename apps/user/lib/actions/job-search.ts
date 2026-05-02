"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireKyc } from "@/lib/actions/verification";
import { sendPushToUsers } from "@/lib/push";

/**
 * 検索フィルター用: 職種一覧を取得
 */
export async function getOccupationOptions() {
  const items = await prisma.occupationSubItem.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      occupationMajorItem: { select: { name: true } },
    },
    orderBy: { occupationMajorItem: { name: "asc" } },
  });

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    majorName: item.occupationMajorItem.name,
  }));
}

/**
 * 案件を検索する（受注者）
 */
export async function searchJobs(filters?: {
  occupationSubItemId?: string;
  areaId?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  prefecture?: string;
  page?: number;
  limit?: number;
}) {
  const user = await requireSession();
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    status: "PUBLISHED",
    deletedAt: null,
    companyId: { not: user.companyId }, // 自社の案件は除外
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

  if (filters?.startDate) {
    where.startDate = { gte: new Date(filters.startDate) };
  }

  if (filters?.prefecture) {
    where.address = { contains: filters.prefecture, mode: "insensitive" };
  }

  const [jobs, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
            trustScore: { select: { overallScore: true, totalTransactions: true } },
          },
        },
        occupationSubItem: { select: { name: true } },
        _count: { select: { applications: true } },
      },
    }),
    prisma.jobPosting.count({ where }),
  ]);

  return {
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      address: job.address,
      startDate: job.startDate,
      endDate: job.endDate,
      compensationType: job.compensationType,
      compensationAmount: job.compensationAmount ? Number(job.compensationAmount) : null,
      occupationName: job.occupationSubItem?.name,
      companyId: job.company.id,
      companyName: job.company.name,
      companyLogo: job.company.logo,
      trustScore: job.company.trustScore
        ? Number(job.company.trustScore.overallScore)
        : null,
      totalTransactions: job.company.trustScore?.totalTransactions ?? 0,
      applicationCount: job._count.applications,
      createdAt: job.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 案件詳細を取得
 */
export async function getJobDetail(jobId: string) {
  const user = await requireSession();

  const job = await prisma.jobPosting.findFirst({
    where: {
      id: jobId,
      deletedAt: null,
    },
    include: {
      company: {
        select: {
          id: true, name: true, logo: true, prefecture: true, city: true,
          trustScore: { select: { overallScore: true, totalTransactions: true } },
        },
      },
      occupationSubItem: {
        select: { name: true, occupationMajorItem: { select: { name: true } } },
      },
      factoryFloor: {
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          startDayRequest: true,
          endDayRequest: true,
          totalAmount: true,
          contentRequest: true,
          priceDetails: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              quantity: true,
              priceUnit: true,
              specifications: true,
              unit: { select: { name: true } },
            },
          },
          images: {
            where: { deletedAt: null },
            select: { id: true, url: true, type: true },
          },
          occupations: {
            select: {
              occupationSubItem: {
                select: { name: true, occupationMajorItem: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!job) throw new Error("案件が見つかりません");

  // 自社の応募状況を取得
  const myApplication = await prisma.jobApplication.findFirst({
    where: {
      jobPostingId: jobId,
      companyId: user.companyId,
    },
    select: {
      id: true,
      status: true,
      jobPosting: {
        select: { factoryFloorId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    ...job,
    compensationAmount: job.compensationAmount ? Number(job.compensationAmount) : null,
    myApplication: myApplication
      ? {
          id: myApplication.id,
          status: myApplication.status,
          factoryFloorId: myApplication.jobPosting.factoryFloorId,
        }
      : null,
  };
}

/**
 * 案件に応募する（受注者）
 */
export async function applyToJob(data: {
  jobPostingId: string;
  message?: string;
}) {
  await requireKyc(); // Level 2必須
  const user = await requireSession();

  const job = await prisma.jobPosting.findFirst({
    where: { id: data.jobPostingId, status: "PUBLISHED", deletedAt: null },
    select: { id: true, title: true, companyId: true },
  });
  if (!job) throw new Error("案件が見つかりません");

  // 自社が既に応募していないか確認
  const existing = await prisma.jobApplication.findFirst({
    where: {
      jobPostingId: data.jobPostingId,
      companyId: user.companyId,
    },
  });
  if (existing) throw new Error("既に応募済みです");

  return prisma.$transaction(async (tx) => {
    const application = await tx.jobApplication.create({
      data: {
        jobPostingId: data.jobPostingId,
        companyId: user.companyId,
        message: data.message,
        status: "PENDING",
      },
    });

    // 発注者に通知
    const ordererUsers = await tx.user.findMany({
      where: { companyId: job.companyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (ordererUsers.length > 0) {
      await tx.notification.createMany({
        data: ordererUsers.map((u) => ({
          userId: u.id,
          title: "案件応募",
          content: `「${job.title}」に応募がありました`,
          type: 27,
          targetId: job.id,
        })),
      });
      void sendPushToUsers({
        userIds: ordererUsers.map((u) => u.id),
        title: "案件応募",
        body: `「${job.title}」に応募がありました`,
        url: `/jobs/${job.id}/applications`,
      });
    }

    return application;
  });
}

/**
 * 自分の応募一覧（受注者）
 */
export async function getMyApplications() {
  const user = await requireSession();

  return prisma.jobApplication.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
    include: {
      jobPosting: {
        select: {
          id: true, title: true, address: true, compensationType: true,
          compensationAmount: true, startDate: true, endDate: true, status: true,
          company: { select: { id: true, name: true } },
        },
      },
    },
  });
}
