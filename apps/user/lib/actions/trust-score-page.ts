"use server";

import { prisma } from "@knock/db";
import { requireSession } from "@/lib/session";

/**
 * 信用スコアページ用データ取得
 */
export async function getTrustScore() {
  const user = await requireSession();

  const score = await prisma.trustScore.findUnique({
    where: { companyId: user.companyId },
  });

  if (!score) {
    return {
      overallScore: 0,
      technicalAvg: 0,
      communicationAvg: 0,
      reliabilityAvg: 0,
      totalTransactions: 0,
      totalAmount: BigInt(0),
      onTimeRate: 0,
      repeatRate: 0,
    };
  }

  return {
    overallScore: score.overallScore,
    technicalAvg: score.technicalAvg,
    communicationAvg: score.communicationAvg,
    reliabilityAvg: score.reliabilityAvg,
    totalTransactions: score.totalTransactions,
    totalAmount: score.totalAmount,
    onTimeRate: score.onTimeRate,
    repeatRate: score.repeatRate,
  };
}
