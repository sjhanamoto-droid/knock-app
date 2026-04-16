import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { skipCSRFCheck } from "@auth/core";
import bcrypt from "bcryptjs";
import { prisma } from "@knock/db";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  skipCSRFCheck,
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

        const user = await prisma.user.findUnique({
          where: { email, deletedAt: null },
          include: { company: true },
        });
        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.lastName} ${user.firstName}`,
          role: user.role,
          companyId: user.companyId,
          companyType: user.company.type,
          activeMode: user.company.type === "BOTH" ? "ORDERER" : user.company.type,
          registrationStep: user.company.registrationStep,
        } as Record<string, unknown>;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // 初回サインイン時にトークンにフィールドをセット
      if (user) {
        token.sub = user.id;
        token.role = (user as unknown as Record<string, unknown>).role;
        token.companyId = (user as unknown as Record<string, unknown>).companyId;
        token.companyType = (user as unknown as Record<string, unknown>).companyType;
        token.activeMode = (user as unknown as Record<string, unknown>).activeMode;
        token.registrationStep = (user as unknown as Record<string, unknown>).registrationStep;
      }

      // セッション更新時
      if (trigger === "update" && session) {
        // companyType の更新（タイプ追加時）
        if (session.companyType) {
          token.companyType = session.companyType;
        }
        // activeMode の更新（モード切替時）
        if (session.activeMode) {
          if (token.companyType === "BOTH") {
            token.activeMode = session.activeMode;
          }
        }
      }

      // DBフォールバック: companyId が未設定の古いトークンに対応
      const userId = token.sub;
      if (userId && !token.companyId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, companyId: true, company: { select: { type: true } } },
        });
        if (dbUser) {
          token.companyId = dbUser.companyId;
          token.companyType = dbUser.company.type;
          if (!token.role) token.role = dbUser.role;
        } else {
          // ユーザーがDBに存在しない（古いセッション）→ トークンを無効化
          token.sub = undefined;
          token.email = undefined;
          token.name = undefined;
        }
      }

      return token;
    },
  },
});
