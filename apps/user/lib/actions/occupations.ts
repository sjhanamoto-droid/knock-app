"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function getOccupationMasters() {
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
}

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
  const user = await requireSession();

  if (user.role !== "REPRESENTATIVE" && user.role !== "MANAGER") {
    throw new Error("権限がありません");
  }

  // Delete existing and re-create
  await prisma.companyOccupation.deleteMany({
    where: { companyId: user.companyId },
  });

  if (selections.length > 0) {
    await prisma.companyOccupation.createMany({
      data: selections.map((s) => ({
        companyId: user.companyId,
        occupationSubItemId: s.occupationSubItemId,
        note: s.note || null,
      })),
    });
  }

  return { success: true };
}
