"use server";

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { sendPushToUsers } from "@/lib/push";

export type AnnouncementTarget = "ALL" | "ORDERER" | "CONTRACTOR";

// 運営からの一斉お知らせ用の通知タイプ。
// targetId を持たないためユーザーアプリ側でルーティングは発生せず、
// 通知一覧にタイトル・内容がそのまま表示される。
const ANNOUNCEMENT_TYPE = 100;

function targetWhere(target: AnnouncementTarget): Prisma.UserWhereInput {
  // 配信対象: 削除されていない有効なユーザー
  if (target === "ORDERER") {
    return { deletedAt: null, isActive: true, company: { type: { in: ["ORDERER", "BOTH"] } } };
  }
  if (target === "CONTRACTOR") {
    return { deletedAt: null, isActive: true, company: { type: { in: ["CONTRACTOR", "BOTH"] } } };
  }
  return { deletedAt: null, isActive: true };
}

/** 配信対象の人数を返す（送信前のプレビュー用） */
export async function countAnnouncementRecipients(target: AnnouncementTarget) {
  await requireAdminSession();
  return prisma.user.count({ where: targetWhere(target) });
}

/**
 * タイトル・内容を、対象（全ユーザー / 発注者 / 受注者）の全員へ一斉送信する。
 * 各ユーザーに通知レコードを作成する。
 */
export async function broadcastAnnouncement(data: {
  title: string;
  content: string;
  target: AnnouncementTarget;
}): Promise<{ success: boolean; count?: number; error?: string }> {
  await requireAdminSession();

  const title = data.title.trim();
  const content = data.content.trim();
  if (!title || !content) {
    return { success: false, error: "タイトルと内容を入力してください" };
  }

  const users = await prisma.user.findMany({
    where: targetWhere(data.target),
    select: { id: true },
  });
  if (users.length === 0) {
    return { success: false, error: "対象のユーザーがいません" };
  }

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      title,
      content,
      type: ANNOUNCEMENT_TYPE,
      seenFlag: false,
    })),
  });

  // アプリ内通知に加えてWebプッシュも送信（端末登録済みユーザーのみ届く）
  await sendPushToUsers({
    userIds: users.map((u) => u.id),
    title,
    body: content,
    url: "/notifications",
  });

  return { success: true, count: users.length };
}
