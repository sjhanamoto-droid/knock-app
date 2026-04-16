"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

/**
 * 空き日スロットを取得（月単位）
 */
export async function getAvailabilitySlots(yearMonth: string) {
  const user = await requireSession();

  const [year, month] = yearMonth.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  return prisma.availabilitySlot.findMany({
    where: {
      companyId: user.companyId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: "asc" },
  });
}

/**
 * 空き日スロットを一括更新
 */
export async function updateAvailabilitySlots(
  slots: { date: string; status: "AVAILABLE" | "BUSY" | "NEGOTIABLE" }[]
) {
  const user = await requireSession();

  await prisma.$transaction(
    slots.map((slot) =>
      prisma.availabilitySlot.upsert({
        where: {
          companyId_date: {
            companyId: user.companyId,
            date: new Date(slot.date),
          },
        },
        create: {
          companyId: user.companyId,
          date: new Date(slot.date),
          status: slot.status,
        },
        update: {
          status: slot.status,
        },
      })
    )
  );

  return { success: true };
}

/**
 * 空き日の公開設定を取得
 */
export async function getAvailabilitySettings() {
  const user = await requireSession();

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { isAvailabilityPublic: true },
  });

  return { isPublic: company?.isAvailabilityPublic ?? false };
}

/**
 * 空き日の公開設定を更新
 */
export async function updateAvailabilityPublic(isPublic: boolean) {
  const user = await requireSession();

  await prisma.company.update({
    where: { id: user.companyId },
    data: { isAvailabilityPublic: isPublic },
  });

  return { success: true };
}
