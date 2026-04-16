import { auth } from "@/auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
  companyType: string;
  activeMode: string;
  registrationStep: number | null; // null = 登録完了, 1-3 = 途中
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const s = session as unknown as Record<string, unknown>;
  const id = session.user.id;
  const companyId = s.companyId as string | undefined;

  // id or companyId が取得できない場合はセッション無効とみなす
  if (!id || !companyId) return null;

  return {
    id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: (s.role as string) ?? "OTHER",
    companyId,
    companyType: (s.companyType as string) ?? "",
    activeMode: (s.activeMode as string) ?? (s.companyType as string) ?? "",
    registrationStep: (s.registrationStep as number | null) ?? null,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
