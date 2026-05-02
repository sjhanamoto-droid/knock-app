"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { sendPushToUsers } from "@/lib/push";

/**
 * 案件を掲載する（発注者）
 */
export async function createJobPosting(data: {
  title: string;
  factoryFloorId?: string;
  occupationSubItemId?: string;
  description?: string;
  requirements?: string;
  requireInvoice?: boolean;
  requireExperienceYears?: number;
  compensationType?: "DAILY" | "LUMP_SUM" | "NEGOTIABLE";
  compensationAmount?: number;
  startDate?: string;
  endDate?: string;
  address?: string;
  images?: string[];
}) {
  const user = await requireSession();

  return prisma.jobPosting.create({
    data: {
      companyId: user.companyId,
      factoryFloorId: data.factoryFloorId || null,
      occupationSubItemId: data.occupationSubItemId || null,
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      requireInvoice: data.requireInvoice ?? false,
      requireExperienceYears: data.requireExperienceYears,
      compensationType: data.compensationType ?? "NEGOTIABLE",
      compensationAmount: data.compensationAmount ? BigInt(data.compensationAmount) : null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      address: data.address,
      images: data.images ?? [],
      status: "PUBLISHED",
    },
  });
}

/**
 * 自社の案件一覧（発注者）
 */
export async function getMyJobPostings() {
  const user = await requireSession();

  return prisma.jobPosting.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { applications: true } },
      occupationSubItem: { select: { name: true } },
    },
  });
}

/**
 * 案件に対する応募一覧（発注者）
 */
export async function getApplicationsForJob(jobPostingId: string) {
  const user = await requireSession();

  // 自社の案件か確認
  const job = await prisma.jobPosting.findFirst({
    where: {
      id: jobPostingId,
      companyId: user.companyId,
      deletedAt: null,
    },
  });
  if (!job) throw new Error("案件が見つかりません");

  return prisma.jobApplication.findMany({
    where: { jobPostingId },
    orderBy: { createdAt: "desc" },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logo: true,
          occupations: {
            include: { occupationSubItem: { select: { name: true } } },
          },
        },
      },
    },
  });
}

/**
 * 応募詳細を取得（発注者）
 */
export async function getApplicationDetail(applicationId: string) {
  const user = await requireSession();

  const application = await prisma.jobApplication.findFirst({
    where: {
      id: applicationId,
      jobPosting: { companyId: user.companyId, deletedAt: null },
    },
    include: {
      jobPosting: {
        select: { id: true, title: true, factoryFloorId: true, status: true },
      },
      company: {
        select: {
          id: true,
          name: true,
          logo: true,
          prefecture: true,
          city: true,
          telNumber: true,
          email: true,
          constructionPermit: true,
          socialInsurance: true,
          invoiceNumber: true,
          occupations: {
            include: { occupationSubItem: { select: { name: true } } },
          },
          areas: {
            include: { area: { select: { name: true } } },
          },
          insurances: { select: { type: true } },
        },
      },
    },
  });

  if (!application) return null;

  return {
    ...application,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    respondedAt: application.respondedAt?.toISOString() ?? null,
  };
}

/**
 * 応募を採用する（発注者）
 * factoryFloorId がある場合は自動で FactoryFloorOrder を作成し、チャットルームも開設する
 */
export async function acceptApplication(applicationId: string) {
  const user = await requireSession();

  const application = await prisma.jobApplication.findFirst({
    where: {
      id: applicationId,
      jobPosting: { companyId: user.companyId },
    },
    include: {
      jobPosting: {
        select: {
          id: true,
          title: true,
          factoryFloorId: true,
          factoryFloor: {
            select: { id: true, name: true, status: true, companyId: true },
          },
        },
      },
      company: { select: { id: true, name: true } },
    },
  });
  if (!application) throw new Error("応募が見つかりません");

  return prisma.$transaction(async (tx) => {
    // 1. 応募ステータスを更新
    await tx.jobApplication.update({
      where: { id: applicationId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    // 2. JobPostingのステータスを FILLED に
    await tx.jobPosting.update({
      where: { id: application.jobPosting.id },
      data: { status: "FILLED" },
    });

    // 3. FactoryFloorがリンクされている場合、自動発注
    const floor = application.jobPosting.factoryFloor;
    if (floor && floor.status === "NOT_ORDERED") {
      // FactoryFloor を更新
      await tx.factoryFloor.update({
        where: { id: floor.id },
        data: {
          status: "ORDERED",
          workCompanyId: application.company.id,
        },
      });

      // FactoryFloorOrder を作成
      await tx.factoryFloorOrder.create({
        data: {
          factoryFloorId: floor.id,
          workCompanyId: application.company.id,
          status: "PENDING",
          message: `「${application.jobPosting.title}」の応募採用により自動作成`,
        },
      });

      // チャットルーム作成（現場情報ルーム）
      const existingRoom = await tx.chatRoom.findFirst({
        where: {
          type: "SITE_INFO",
          factoryFloorId: floor.id,
        },
      });

      if (!existingRoom) {
        const room = await tx.chatRoom.create({
          data: {
            type: "SITE_INFO",
            orderCompanyId: floor.companyId,
            workerCompanyId: application.company.id,
            factoryFloorId: floor.id,
          },
        });

        // 両社のユーザーをメンバーに追加
        const [ordererUsers, contractorUsersForChat] = await Promise.all([
          tx.user.findMany({
            where: { companyId: floor.companyId, isActive: true, deletedAt: null },
            select: { id: true },
          }),
          tx.user.findMany({
            where: { companyId: application.company.id, isActive: true, deletedAt: null },
            select: { id: true },
          }),
        ]);

        const allMembers = [...ordererUsers, ...contractorUsersForChat];
        if (allMembers.length > 0) {
          await tx.chatRoomMember.createMany({
            data: allMembers.map((u) => ({
              roomId: room.id,
              userId: u.id,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    // 4. 受注者に通知
    const contractorUsers = await tx.user.findMany({
      where: { companyId: application.company.id, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (contractorUsers.length > 0) {
      await tx.notification.createMany({
        data: contractorUsers.map((u) => ({
          userId: u.id,
          title: "応募採用",
          content: `「${application.jobPosting.title}」への応募が採用されました`,
          type: 28,
          targetId: application.jobPosting.id,
        })),
      });
      void sendPushToUsers({
        userIds: contractorUsers.map((u) => u.id),
        title: "応募採用",
        body: `「${application.jobPosting.title}」への応募が採用されました`,
        url: `/jobs/${application.jobPosting.id}`,
      });
    }

    return application;
  });
}

/**
 * 応募を不採用にする（発注者）
 */
export async function rejectApplication(applicationId: string) {
  const user = await requireSession();

  const application = await prisma.jobApplication.findFirst({
    where: {
      id: applicationId,
      jobPosting: { companyId: user.companyId },
    },
    include: {
      jobPosting: { select: { id: true, title: true } },
      company: { select: { id: true } },
    },
  });
  if (!application) throw new Error("応募が見つかりません");

  return prisma.$transaction(async (tx) => {
    await tx.jobApplication.update({
      where: { id: applicationId },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    const contractorUsers = await tx.user.findMany({
      where: { companyId: application.company.id, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (contractorUsers.length > 0) {
      await tx.notification.createMany({
        data: contractorUsers.map((u) => ({
          userId: u.id,
          title: "応募結果",
          content: `「${application.jobPosting.title}」への応募は見送りとなりました`,
          type: 28,
          targetId: application.jobPosting.id,
        })),
      });
      void sendPushToUsers({
        userIds: contractorUsers.map((u) => u.id),
        title: "応募結果",
        body: `「${application.jobPosting.title}」への応募は見送りとなりました`,
        url: `/jobs/${application.jobPosting.id}`,
      });
    }
  });
}
