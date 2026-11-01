/**
 * 現場ステータスのロールアップ（発注書の完了状況 → 現場）。
 * 施工報告(orders.ts)と出来高の確定(progress-billing.ts)の両方から使うため helper に置く。
 * "use server" を付けない通常モジュール（tx を受け取る内部関数をサーバーアクションとして公開しないため）。
 */

import type { Prisma } from "@/generated/prisma";

/**
 * 発注書(FactoryFloorOrder)の状態から現場ステータスを算出して反映する。
 * - 回答待ち(PENDING/APPROVED)の発注、または未完了(≠CLOSED)の確定発注が1つでもあれば「施工中」
 * - 確定発注がすべて完了(CLOSED)なら「工事完了」（finishDay = 最終の完了日）
 * 追加工事の依頼で 工事完了→施工中 に戻り、その施工報告で再び 工事完了 になる往復をここで担う。
 * 発注前(未発注/下書き/発注済)や取引終端(DEAL_COMPLETED)の現場は対象外。
 */
export async function rollupFloorCompletion(tx: Prisma.TransactionClient, factoryFloorId: string) {
  const floor = await tx.factoryFloor.findUnique({
    where: { id: factoryFloorId },
    select: { status: true, finishDay: true },
  });
  if (!floor) return null;
  if (floor.status !== "IN_PROGRESS" && floor.status !== "COMPLETED") return floor.status;

  const orders = await tx.factoryFloorOrder.findMany({
    where: { factoryFloorId, deletedAt: null, status: { in: ["PENDING", "APPROVED", "CONFIRMED"] } },
    select: { status: true, completionStatus: true, completedDay: true },
  });
  const confirmed = orders.filter((o) => o.status === "CONFIRMED");
  const hasOpen = orders.some((o) => o.status !== "CONFIRMED" || o.completionStatus !== "CLOSED");
  const nextStatus = confirmed.length > 0 && !hasOpen ? "COMPLETED" : "IN_PROGRESS";

  // 現場の完了日 = 完了済み発注書の最終完了日
  const latestCompleted = confirmed
    .map((o) => o.completedDay)
    .filter((d): d is Date => !!d)
    .reduce<Date | null>((mx, d) => (!mx || d > mx ? d : mx), null);

  await tx.factoryFloor.update({
    where: { id: factoryFloorId },
    data: { status: nextStatus, finishDay: latestCompleted ?? floor.finishDay },
  });
  return nextStatus;
}
