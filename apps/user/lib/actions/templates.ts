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

const DEFAULT_TEMPLATES = [
  {
    name: "初回ご挨拶",
    content:
      "はじめまして。Knockにてプロフィールを拝見し、ご連絡させていただきました。\n当社は建設業を営んでおり、貴社のお力をお借りできればと考えております。\nまずはご挨拶まで、今後ともよろしくお願いいたします。",
  },
  {
    name: "案件のご相談",
    content:
      "お世話になっております。\n現在進行中の案件についてご相談させていただきたく、ご連絡いたしました。\n詳細につきましては、お打ち合わせのお時間をいただけますと幸いです。\nご都合の良い日時をお知らせください。",
  },
  {
    name: "お見積り依頼",
    content:
      "お世話になっております。\n下記案件につきまして、お見積りをお願いしたくご連絡いたしました。\n\n■案件概要\n・現場名：\n・工期：\n・作業内容：\n\n詳細は改めてお伝えいたしますので、ご検討のほどよろしくお願いいたします。",
  },
  {
    name: "日程調整",
    content:
      "お世話になっております。\n作業日程の調整をお願いしたくご連絡いたしました。\n以下の日程でご都合いかがでしょうか。\n\n・第1希望：\n・第2希望：\n・第3希望：\n\nご確認のほど、よろしくお願いいたします。",
  },
  {
    name: "完了のご報告・お礼",
    content:
      "お世話になっております。\nこの度はご協力いただき、誠にありがとうございました。\nおかげさまで無事に作業を完了することができました。\n今後ともよろしくお願いいたします。",
  },
];

export async function createDefaultTemplates(companyId: string) {
  await prisma.templateMessage.createMany({
    data: DEFAULT_TEMPLATES.map((t) => ({
      name: t.name,
      content: t.content,
      companyId,
    })),
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
