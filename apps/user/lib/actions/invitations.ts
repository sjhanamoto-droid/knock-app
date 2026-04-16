"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { sendPushToUsers } from "@/lib/push";

// ============ ステータス確認 ============

export async function getInvitationStatus(
  targetCompanyId: string
): Promise<"none" | "pending" | "connected"> {
  const user = await requireSession();

  // 繋がり済チェック
  const matching = await prisma.matching.findFirst({
    where: {
      deletedAt: null,
      OR: [
        {
          inviteCompanyId: user.companyId,
          beInviteCompanyId: targetCompanyId,
        },
        {
          inviteCompanyId: targetCompanyId,
          beInviteCompanyId: user.companyId,
        },
      ],
    },
  });
  if (matching) return "connected";

  // リクエスト送信済チェック
  const invited = await prisma.invited.findFirst({
    where: {
      deletedAt: null,
      OR: [
        {
          inviteCompanyId: user.companyId,
          invitedCompanyId: targetCompanyId,
        },
        {
          inviteCompanyId: targetCompanyId,
          invitedCompanyId: user.companyId,
        },
      ],
    },
  });
  if (invited) return "pending";

  return "none";
}

// ============ 連絡リクエスト送信 ============

export async function sendConnectionRequest(targetCompanyId: string) {
  const user = await requireSession();

  if (user.companyId === targetCompanyId) {
    throw new Error("自社にはリクエストを送信できません");
  }

  // 重複チェック
  const status = await getInvitationStatus(targetCompanyId);
  if (status === "connected") throw new Error("既につながっています");
  if (status === "pending") throw new Error("リクエストは送信済です");

  // 対象会社確認（発注者→受注者、受注者→発注者の双方向リクエストに対応）
  const targetCompany = await prisma.company.findFirst({
    where: {
      id: targetCompanyId,
      isActive: true,
      deletedAt: null,
    },
  });
  if (!targetCompany) throw new Error("対象の会社が見つかりません");

  // 自社名を取得
  const myCompany = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { name: true },
  });

  // Invited レコード作成
  const invited = await prisma.invited.create({
    data: {
      inviteCompanyId: user.companyId,
      invitedCompanyId: targetCompanyId,
    },
  });

  // 受注者全ユーザーに通知
  const targetUsers = await prisma.user.findMany({
    where: {
      companyId: targetCompanyId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (targetUsers.length > 0) {
    await prisma.notification.createMany({
      data: targetUsers.map((u) => ({
        userId: u.id,
        title: "連絡リクエスト",
        content: `${myCompany?.name ?? "企業"}から連絡リクエストが届きました`,
        type: 17,
        targetId: invited.id,
      })),
    });
    void sendPushToUsers({
      userIds: targetUsers.map((u) => u.id),
      title: "連絡リクエスト",
      body: `${myCompany?.name ?? "企業"}から連絡リクエストが届きました`,
      url: `/invitations/${invited.id}`,
    });
  }

  return invited;
}

// ============ 招待詳細取得 ============

export async function getInvitation(invitedId: string) {
  const user = await requireSession();

  const invited = await prisma.invited.findFirst({
    where: {
      id: invitedId,
      invitedCompanyId: user.companyId,
      deletedAt: null,
    },
    include: {
      inviteCompany: {
        select: {
          id: true,
          name: true,
          logo: true,
          prefecture: true,
          city: true,
          streetAddress: true,
          telNumber: true,
          hpUrl: true,
          companyForm: true,
          fireInsurance: true,
          socialInsurance: true,
          otherInsurance: true,
          note: true,
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
      },
    },
  });

  return invited;
}

// ============ 承認 ============

export async function approveInvitation(invitedId: string) {
  const user = await requireSession();

  const invited = await prisma.invited.findFirst({
    where: {
      id: invitedId,
      invitedCompanyId: user.companyId,
      deletedAt: null,
    },
  });
  if (!invited) throw new Error("招待が見つかりません");

  return prisma.$transaction(async (tx) => {
    // 1. Invited を論理削除
    await tx.invited.update({
      where: { id: invitedId },
      data: { deletedAt: new Date() },
    });

    // 2. Matching 作成
    await tx.matching.create({
      data: {
        inviteCompanyId: invited.inviteCompanyId,
        beInviteCompanyId: invited.invitedCompanyId,
      },
    });

    // 3. NEGOTIATION チャットルーム作成
    const chatRoom = await tx.chatRoom.create({
      data: {
        orderCompanyId: invited.inviteCompanyId,
        workerCompanyId: invited.invitedCompanyId,
        type: "NEGOTIATION",
        status: "OPEN",
        lastMessageTime: new Date(),
      },
    });

    // 4. 両社のアクティブユーザーをメンバーに追加
    const allUsers = await tx.user.findMany({
      where: {
        companyId: {
          in: [invited.inviteCompanyId, invited.invitedCompanyId],
        },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (allUsers.length > 0) {
      await tx.chatRoomMember.createMany({
        data: allUsers.map((u) => ({
          roomId: chatRoom.id,
          userId: u.id,
          roleUser: 2,
        })),
      });
    }

    // 5. 初回 ACTION メッセージ
    await tx.message.create({
      data: {
        roomId: chatRoom.id,
        userId: user.id,
        message: "つながりが成立しました",
        type: "ACTION",
      },
    });

    // 6. 招待元ユーザーに通知
    const inviterUsers = await tx.user.findMany({
      where: {
        companyId: invited.inviteCompanyId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    const myCompany = await tx.company.findUnique({
      where: { id: user.companyId },
      select: { name: true },
    });

    if (inviterUsers.length > 0) {
      await tx.notification.createMany({
        data: inviterUsers.map((u) => ({
          userId: u.id,
          title: "つながり成立",
          content: `${myCompany?.name ?? "企業"}とのつながりが成立しました`,
          type: 18,
          roomId: chatRoom.id,
          targetId: chatRoom.id,
        })),
      });
      void sendPushToUsers({
        userIds: inviterUsers.map((u) => u.id),
        title: "つながり成立",
        body: `${myCompany?.name ?? "企業"}とのつながりが成立しました`,
        url: `/chat/${chatRoom.id}`,
      });
    }

    return chatRoom;
  });
}

// ============ 拒否 ============

export async function rejectInvitation(invitedId: string) {
  const user = await requireSession();

  const invited = await prisma.invited.findFirst({
    where: {
      id: invitedId,
      invitedCompanyId: user.companyId,
      deletedAt: null,
    },
  });
  if (!invited) throw new Error("招待が見つかりません");

  return prisma.invited.update({
    where: { id: invitedId },
    data: { deletedAt: new Date() },
  });
}
