"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

// ============ 受注者検索（フィルター対応） ============

export async function searchContractors(filters?: {
  keyword?: string;
  occupationMajorItemId?: string;
  prefecture?: string;
}) {
  const user = await requireSession();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    type: { in: ["CONTRACTOR", "BOTH"] },
    isActive: true,
    deletedAt: null,
    id: { not: user.companyId }, // 自社を除外
  };

  if (filters?.keyword && filters.keyword.trim()) {
    where.name = { contains: filters.keyword.trim(), mode: "insensitive" };
  }

  if (filters?.occupationMajorItemId) {
    where.occupations = {
      some: {
        occupationSubItem: {
          occupationMajorItemId: filters.occupationMajorItemId,
        },
      },
    };
  }

  if (filters?.prefecture) {
    where.prefecture = filters.prefecture;
  }

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      logo: true,
      prefecture: true,
      city: true,
      occupations: {
        include: {
          occupationSubItem: {
            include: { occupationMajorItem: true },
          },
        },
      },
      areas: {
        include: { area: true },
      },
    },
  });

  // 繋がり情報を取得
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
      m.inviteCompanyId === user.companyId
        ? m.beInviteCompanyId
        : m.inviteCompanyId
    )
  );

  const pendingIds = new Set(
    inviteds.map((i) =>
      i.inviteCompanyId === user.companyId
        ? i.invitedCompanyId
        : i.inviteCompanyId
    )
  );

  return companies.map((c) => ({
    ...c,
    isConnected: connectedIds.has(c.id),
    connectionStatus: connectedIds.has(c.id)
      ? ("connected" as const)
      : pendingIds.has(c.id)
        ? ("pending" as const)
        : ("none" as const),
  }));
}

// ============ 受注者詳細 ============

export async function getContractor(companyId: string) {
  const user = await requireSession();

  // 受注者検索からも招待通知からも利用可能にするため、typeフィルタを外す
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      logo: true,
      backgroundImage: true,
      postalCode: true,
      prefecture: true,
      city: true,
      streetAddress: true,
      building: true,
      telNumber: true,
      hpUrl: true,
      companyForm: true,
      selfIntro: true,
      note: true,
      invoiceNumber: true,
      yearsOfExperience: true,
      isAcceptingWork: true,
      isAvailabilityPublic: true,
      fireInsurance: true,
      socialInsurance: true,
      otherInsurance: true,
      users: {
        where: { deletedAt: null, isActive: true },
        select: {
          id: true,
          lastName: true,
          firstName: true,
          dateOfBirth: true,
        },
        take: 1,
      },
      occupations: {
        include: {
          occupationSubItem: {
            include: { occupationMajorItem: true },
          },
        },
      },
      areas: {
        include: { area: true },
      },
      trustScore: {
        select: {
          overallScore: true,
          technicalAvg: true,
          communicationAvg: true,
          reliabilityAvg: true,
          totalTransactions: true,
          onTimeRate: true,
          repeatRate: true,
        },
      },
      _count: {
        select: {
          receivedEvaluations: true,
        },
      },
    },
  });

  // 空きスケジュール（公開設定ONの場合のみ取得、今日から30日分）
  let availabilitySlots: { date: Date; status: string }[] = [];
  if (company?.isAvailabilityPublic) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    availabilitySlots = await prisma.availabilitySlot.findMany({
      where: {
        companyId,
        isPublic: true,
        date: { gte: today, lte: thirtyDaysLater },
      },
      orderBy: { date: "asc" },
      select: { date: true, status: true },
    });
  }

  if (!company) return null;

  // 繋がり判定
  const matching = await prisma.matching.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { inviteCompanyId: user.companyId, beInviteCompanyId: companyId },
        { inviteCompanyId: companyId, beInviteCompanyId: user.companyId },
      ],
    },
  });

  // 招待ステータス（sent=自分が送った / received=相手から受けた / connected / none）
  let invitationStatus: "none" | "sent" | "received" | "connected" = "none";
  let chatRoomId: string | null = null;
  let invitedId: string | null = null;

  if (matching) {
    invitationStatus = "connected";
    // NEGOTIATION チャットルームのIDを取得
    const room = await prisma.chatRoom.findFirst({
      where: {
        type: "NEGOTIATION",
        deletedAt: null,
        OR: [
          { orderCompanyId: user.companyId, workerCompanyId: companyId },
          { orderCompanyId: companyId, workerCompanyId: user.companyId },
        ],
      },
      select: { id: true },
    });
    chatRoomId = room?.id ?? null;
  } else {
    const invited = await prisma.invited.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { inviteCompanyId: user.companyId, invitedCompanyId: companyId },
          { inviteCompanyId: companyId, invitedCompanyId: user.companyId },
        ],
      },
    });
    if (invited) {
      // 自分が送ったか受けたかを区別
      invitationStatus = invited.inviteCompanyId === user.companyId ? "sent" : "received";
      invitedId = invited.id;
    }
  }

  // 代表者情報
  const rep = company.users[0] ?? null;
  let repAge: number | null = null;
  if (rep?.dateOfBirth) {
    const dob = new Date(rep.dateOfBirth);
    const today = new Date();
    repAge = today.getFullYear() - dob.getFullYear();
    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
    ) {
      repAge -= 1;
    }
  }

  return {
    ...company,
    repName: rep ? `${rep.lastName} ${rep.firstName}` : null,
    repAge,
    availabilitySlots: availabilitySlots.map((s) => ({
      date: s.date.toISOString(),
      status: s.status,
    })),
    evaluationCount: company._count.receivedEvaluations,
    trustScore: company.trustScore
      ? {
          overallScore: Number(company.trustScore.overallScore),
          technicalAvg: Number(company.trustScore.technicalAvg),
          communicationAvg: Number(company.trustScore.communicationAvg),
          reliabilityAvg: Number(company.trustScore.reliabilityAvg),
          totalTransactions: company.trustScore.totalTransactions,
          onTimeRate: Number(company.trustScore.onTimeRate),
          repeatRate: Number(company.trustScore.repeatRate),
        }
      : null,
    isConnected: !!matching,
    invitationStatus,
    chatRoomId,
    invitedId,
  };
}

// ============ エリアマスタ ============

export async function getAreas() {
  return prisma.area.findMany({
    where: { deletedAt: null },
    orderBy: { serialNumber: "asc" },
    select: { id: true, name: true },
  });
}
