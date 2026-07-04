"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { unstable_cache } from "next/cache";

export const getOccupationMasters = unstable_cache(
  async () => {
    const majors = await prisma.occupationMajorItem.findMany({
      include: {
        subItems: {
          select: { id: true, name: true },
        },
      },
      orderBy: { id: "asc" },
    });

    return majors.map((m) => ({
      id: m.id,
      name: m.name,
      subItems: m.subItems,
    }));
  },
  ["occupation-masters"],
  { revalidate: 3600 }
);

export async function getCompanyOccupations() {
  const user = await requireSession();

  const occupations = await prisma.companyOccupation.findMany({
    where: { companyId: user.companyId },
    select: {
      id: true,
      occupationSubItemId: true,
      note: true,
    },
  });

  return occupations;
}

export async function saveCompanyOccupations(
  selections: { occupationSubItemId: string; note?: string }[]
) {
  // 自社プロフィールの編集は updateCompany（住所・口座等）と同様に全メンバー可
  const user = await requireSession();

  // Delete existing and re-create（アトミックに実行）
  await prisma.$transaction(async (tx) => {
    await tx.companyOccupation.deleteMany({
      where: { companyId: user.companyId },
    });

    if (selections.length > 0) {
      await tx.companyOccupation.createMany({
        data: selections.map((s) => ({
          companyId: user.companyId,
          occupationSubItemId: s.occupationSubItemId,
          note: s.note || null,
        })),
      });
    }
  });

  return { success: true };
}
