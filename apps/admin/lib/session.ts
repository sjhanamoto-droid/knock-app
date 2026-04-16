import { auth } from "@/auth";
import { prisma } from "@knock/db";

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  roleId: number;
  adminCompanyId: string;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth();
  if (!session?.user) return null;

  const s = session as unknown as Record<string, unknown>;
  let adminCompanyId = s.adminCompanyId as string | undefined;
  let roleId = s.roleId as number | undefined;
  const userId = session.user.id;

  // Fallback: if adminCompanyId is missing from session, look it up from DB
  if (!adminCompanyId && userId) {
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { adminCompanyId: true, roleId: true },
    });
    if (adminUser) {
      adminCompanyId = adminUser.adminCompanyId;
      roleId = roleId ?? adminUser.roleId;
    }
  }

  if (!adminCompanyId || !userId) return null;

  return {
    id: userId,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    roleId: roleId ?? 1,
    adminCompanyId,
  };
}

export async function requireAdminSession(): Promise<AdminSession> {
  const admin = await getAdminSession();
  if (!admin) throw new Error("Unauthorized");
  return admin;
}
