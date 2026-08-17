/**
 * 「すでに非VOIDの請求書に含まれている発注(FactoryFloorOrder)ID」を集約するヘルパー。
 *
 * 請求書(Document type=INVOICE)の metadata.orderIds を唯一の真実として、
 * 二重請求ガード(生成)・候補表示・発注選択の各経路で共通利用する。
 * これにより「同じ会社で請求書が複数枚になるのはOK・同じ発注(工事)の二重請求は防ぐ」
 * を全経路で一貫させる。
 *
 * excludeInvoiceIds に渡した請求書は集約対象から除外する。
 * （再集計(recalculateInvoice)/作り直し(rebuildInvoiceFromOrders)は「新しい請求書を
 *   作ってから旧をVOID化」する順序のため、生成時点でまだ非VOIDの旧請求書を除外しないと、
 *   自分自身の発注まで"請求済み"扱いになって空になってしまう。）
 *
 * "use server" を付けない通常モジュール(action / service の両方から import するため)。
 */

import { prisma } from "@/lib/prisma";

export async function getInvoicedOrderIds(args: {
  /** 受注者(請求される側)会社ID。指定するとそのペアに絞る（生成関数用） */
  workerCompanyId?: string;
  /** 発注者(請求する側)会社ID。指定するとそのペアに絞る（生成関数用） */
  orderCompanyId?: string;
  /** 受注者/発注者どちらかがこの会社の請求書に絞る（候補・一覧用） */
  companyIdEitherSide?: string;
  /** 集約から除外する請求書ID（再集計/作り直し中の自分自身） */
  excludeInvoiceIds?: string[];
}): Promise<Set<string>> {
  const { workerCompanyId, orderCompanyId, companyIdEitherSide, excludeInvoiceIds = [] } = args;

  const invoices = await prisma.document.findMany({
    where: {
      type: "INVOICE",
      deletedAt: null,
      status: { not: "VOID" },
      ...(excludeInvoiceIds.length > 0 ? { id: { notIn: excludeInvoiceIds } } : {}),
      ...(companyIdEitherSide
        ? {
            OR: [
              { workerCompanyId: companyIdEitherSide },
              { orderCompanyId: companyIdEitherSide },
            ],
          }
        : {
            ...(workerCompanyId ? { workerCompanyId } : {}),
            ...(orderCompanyId ? { orderCompanyId } : {}),
          }),
    },
    select: { metadata: true },
  });

  const ids = new Set<string>();
  for (const inv of invoices) {
    const meta = inv.metadata as Record<string, unknown> | null;
    const orderIds = (meta?.orderIds as string[]) ?? [];
    for (const id of orderIds) ids.add(id);
  }
  return ids;
}
