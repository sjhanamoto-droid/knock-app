"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { recalculateTrustScore } from "@/lib/services/trust-score";
import { sendPushToUsers } from "@/lib/push";

/**
 * 評価を送信する
 */
export async function submitEvaluation(data: {
  factoryFloorOrderId: string;
  evaluateeCompanyId: string;
  technicalSkill: number;
  communication: number;
  reliability: number;
  comment?: string;
}) {
  const user = await requireSession();

  // 取引が存在し、自社が関係しているか確認
  const order = await prisma.factoryFloorOrder.findFirst({
    where: {
      id: data.factoryFloorOrderId,
      deletedAt: null,
      factoryFloor: {
        OR: [
          { companyId: user.companyId },
          { workCompanyId: user.companyId },
        ],
        deletedAt: null,
      },
    },
  });
  if (!order) throw new Error("取引が見つかりません");

  // 既に評価済みか確認
  const existing = await prisma.evaluation.findFirst({
    where: {
      factoryFloorOrderId: data.factoryFloorOrderId,
      evaluatorCompanyId: user.companyId,
    },
  });
  if (existing) throw new Error("既に評価済みです");

  return prisma.$transaction(async (tx) => {
    const evaluation = await tx.evaluation.create({
      data: {
        factoryFloorOrderId: data.factoryFloorOrderId,
        evaluatorCompanyId: user.companyId,
        evaluateeCompanyId: data.evaluateeCompanyId,
        technicalSkill: data.technicalSkill,
        communication: data.communication,
        reliability: data.reliability,
        comment: data.comment,
      },
    });

    // 被評価者に通知
    const evaluateeUsers = await tx.user.findMany({
      where: { companyId: data.evaluateeCompanyId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (evaluateeUsers.length > 0) {
      await tx.notification.createMany({
        data: evaluateeUsers.map((u) => ({
          userId: u.id,
          title: "評価を受けました",
          content: "取引相手から評価が届きました",
          type: 23,
          targetId: evaluation.id,
        })),
      });
      void sendPushToUsers({
        userIds: evaluateeUsers.map((u) => u.id),
        title: "評価を受けました",
        body: "取引相手から評価が届きました",
        url: `/orders/${evaluation.id}`,
      });
    }

    // 信用スコアを再計算
    await recalculateTrustScore(data.evaluateeCompanyId);

    return evaluation;
  });
}

/**
 * 取引に対する評価を取得
 */
export async function getEvaluationForOrder(orderId: string) {
  const user = await requireSession();

  return prisma.evaluation.findMany({
    where: {
      factoryFloorOrderId: orderId,
    },
    include: {
      evaluatorCompany: { select: { id: true, name: true } },
      evaluateeCompany: { select: { id: true, name: true } },
    },
  });
}

/**
 * 自社が受けた評価一覧
 */
export async function getReceivedEvaluations(page = 1, limit = 20) {
  const user = await requireSession();
  const skip = (page - 1) * limit;

  const [evaluations, total] = await Promise.all([
    prisma.evaluation.findMany({
      where: { evaluateeCompanyId: user.companyId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        evaluatorCompany: { select: { id: true, name: true } },
        factoryFloorOrder: {
          select: {
            factoryFloor: { select: { name: true } },
          },
        },
      },
    }),
    prisma.evaluation.count({ where: { evaluateeCompanyId: user.companyId } }),
  ]);

  return { evaluations, total, page, totalPages: Math.ceil(total / limit) };
}
