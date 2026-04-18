import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { skipCSRFCheck } from "@auth/core";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  skipCSRFCheck,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.roleId = (user as unknown as Record<string, unknown>).roleId;
        token.adminCompanyId = (user as unknown as Record<string, unknown>).adminCompanyId;
      }
      // Fallback: if adminCompanyId is missing (stale token), look it up from DB
      const userId = token.sub;
      if (userId && !token.adminCompanyId) {
        const adminUser = await prisma.adminUser.findUnique({
          where: { id: userId },
          select: { adminCompanyId: true, roleId: true },
        });
        if (adminUser) {
          token.adminCompanyId = adminUser.adminCompanyId;
          if (!token.roleId) token.roleId = adminUser.roleId;
        }
      }
      return token;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials.email as string;
        const password = credentials.password as string;
        if (!email || !password) return null;

        const adminUser = await prisma.adminUser.findUnique({
          where: { email, deletedAt: null },
        });
        if (!adminUser || !adminUser.isActive) return null;

        const isValid = await bcrypt.compare(password, adminUser.password);
        if (!isValid) return null;

        return {
          id: adminUser.id,
          email: adminUser.email,
          name: `${adminUser.lastName} ${adminUser.firstName}`,
          roleId: adminUser.roleId,
          adminCompanyId: adminUser.adminCompanyId,
        } as Record<string, unknown>;
      },
    }),
  ],
});
