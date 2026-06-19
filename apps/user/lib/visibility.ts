import { prisma } from "@/lib/prisma";

/**
 * 受注者「非表示」機能の表示制御ヘルパー。
 *
 * 「繋がり申請をしている」= Matching(承認済み) または Invited(申請中) が
 * 双方向いずれかに存在する状態とみなす（仕様確定: 申請中も繋がりありとして扱う）。
 */

/**
 * 指定会社が Matching または Invited の関係を持つ相手会社IDの集合を返す（双方向）。
 * 自社IDは含まれない。
 */
export async function getRelatedCompanyIds(
  companyId: string
): Promise<Set<string>> {
  const [matchings, inviteds] = await Promise.all([
    prisma.matching.findMany({
      where: {
        deletedAt: null,
        OR: [
          { inviteCompanyId: companyId },
          { beInviteCompanyId: companyId },
        ],
      },
      select: { inviteCompanyId: true, beInviteCompanyId: true },
    }),
    prisma.invited.findMany({
      where: {
        deletedAt: null,
        OR: [
          { inviteCompanyId: companyId },
          { invitedCompanyId: companyId },
        ],
      },
      select: { inviteCompanyId: true, invitedCompanyId: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const m of matchings) {
    ids.add(
      m.inviteCompanyId === companyId ? m.beInviteCompanyId : m.inviteCompanyId
    );
  }
  for (const i of inviteds) {
    ids.add(
      i.inviteCompanyId === companyId ? i.invitedCompanyId : i.inviteCompanyId
    );
  }
  ids.delete(companyId);
  return ids;
}

/**
 * 自社が「非表示」設定の受注者かどうかを返す。
 */
export async function isViewerHidden(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { isHidden: true },
  });
  return company?.isHidden ?? false;
}
