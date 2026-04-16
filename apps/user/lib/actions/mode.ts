"use server";

import { auth } from "@/auth";

/**
 * クライアント側でモード情報を取得するためのサーバーアクション
 */
export async function getSessionMode() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const s = session as unknown as Record<string, unknown>;
  const companyId = s.companyId as string | undefined;
  // companyId が取得できない場合はセッション無効
  if (!companyId) return null;

  const companyType = (s.companyType as string) ?? "";
  const activeMode = (s.activeMode as string) ?? companyType;

  return { companyType, activeMode };
}
