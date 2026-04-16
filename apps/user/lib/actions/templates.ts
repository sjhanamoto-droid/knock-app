"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function getTemplates() {
  const user = await requireSession();

  return prisma.templateMessage.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTemplate(id: string) {
  const user = await requireSession();

  return prisma.templateMessage.findFirst({
    where: {
      id,
      companyId: user.companyId,
      deletedAt: null,
    },
  });
}

export async function createTemplate(data: { name: string; content: string }) {
  const user = await requireSession();

  return prisma.templateMessage.create({
    data: {
      name: data.name,
      content: data.content,
      companyId: user.companyId,
    },
  });
}

export async function updateTemplate(
  id: string,
  data: { name?: string; content?: string }
) {
  const user = await requireSession();

  const template = await prisma.templateMessage.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!template) throw new Error("テンプレートが見つかりません");

  return prisma.templateMessage.update({
    where: { id },
    data,
  });
}

export async function deleteTemplate(id: string) {
  const user = await requireSession();

  const template = await prisma.templateMessage.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
  });
  if (!template) throw new Error("テンプレートが見つかりません");

  return prisma.templateMessage.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
