import { prisma } from "@knock/db";

/**
 * 信用スコアを再計算
 *
 * 構成要素:
 * - 取引回数（完了数）
 * - 取引金額（累計）
 * - 納期遵守率（完了報告の期日内率）
 * - 相互評価の平均点（技術力・コミュニケーション・信頼性）
 * - リピート率
 */
export async function recalculateTrustScore(companyId: string): Promise<void> {
  // 1. 評価データを集計
  const evaluations = await prisma.evaluation.findMany({
    where: { evaluateeCompanyId: companyId },
    select: {
      technicalSkill: true,
      communication: true,
      reliability: true,
    },
  });

  const evalCount = evaluations.length;
  let technicalAvg = 0;
  let communicationAvg = 0;
  let reliabilityAvg = 0;

  if (evalCount > 0) {
    technicalAvg = evaluations.reduce((s, e) => s + e.technicalSkill, 0) / evalCount;
    communicationAvg = evaluations.reduce((s, e) => s + e.communication, 0) / evalCount;
    reliabilityAvg = evaluations.reduce((s, e) => s + e.reliability, 0) / evalCount;
  }

  const overallScore = evalCount > 0
    ? (technicalAvg + communicationAvg + reliabilityAvg) / 3
    : 0;

  // 2. 取引実績を集計
  const completedOrders = await prisma.factoryFloorOrder.findMany({
    where: {
      deletedAt: null,
      factoryFloor: {
        OR: [
          { companyId, status: { in: ["DEAL_COMPLETED", "COMPLETED"] } },
          { workCompanyId: companyId, status: { in: ["DEAL_COMPLETED", "COMPLETED"] } },
        ],
        deletedAt: null,
      },
    },
    select: {
      actualAmount: true,
      factoryFloor: {
        select: {
          totalAmount: true,
          companyId: true,
          workCompanyId: true,
          endDayRequest: true,
          finishDay: true,
        },
      },
    },
  });

  const totalTransactions = completedOrders.length;
  let totalAmount = BigInt(0);
  let onTimeCount = 0;

  for (const order of completedOrders) {
    totalAmount += order.actualAmount ?? order.factoryFloor.totalAmount ?? BigInt(0);

    // 納期遵守チェック
    if (order.factoryFloor.endDayRequest && order.factoryFloor.finishDay) {
      if (order.factoryFloor.finishDay <= order.factoryFloor.endDayRequest) {
        onTimeCount++;
      }
    } else {
      // 期日データがない場合は遵守扱い
      onTimeCount++;
    }
  }

  const onTimeRate = totalTransactions > 0
    ? (onTimeCount / totalTransactions) * 100
    : 0;

  // 3. リピート率を計算
  const uniquePartners = new Set<string>();
  const partnerCounts: Record<string, number> = {};

  for (const order of completedOrders) {
    const partnerId = order.factoryFloor.companyId === companyId
      ? order.factoryFloor.workCompanyId ?? ""
      : order.factoryFloor.companyId;

    if (partnerId) {
      uniquePartners.add(partnerId);
      partnerCounts[partnerId] = (partnerCounts[partnerId] || 0) + 1;
    }
  }

  const repeatPartners = Object.values(partnerCounts).filter((c) => c > 1).length;
  const repeatRate = uniquePartners.size > 0
    ? (repeatPartners / uniquePartners.size) * 100
    : 0;

  // 4. TrustScore をupsert
  await prisma.trustScore.upsert({
    where: { companyId },
    create: {
      companyId,
      overallScore: overallScore,
      technicalAvg,
      communicationAvg,
      reliabilityAvg,
      totalTransactions,
      totalAmount,
      onTimeRate,
      repeatRate,
      lastCalculatedAt: new Date(),
    },
    update: {
      overallScore: overallScore,
      technicalAvg,
      communicationAvg,
      reliabilityAvg,
      totalTransactions,
      totalAmount,
      onTimeRate,
      repeatRate,
      lastCalculatedAt: new Date(),
    },
  });
}
