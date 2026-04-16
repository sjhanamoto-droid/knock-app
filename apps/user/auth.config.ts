import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const publicPaths = ["/login", "/forgot-password", "/reset-password", "/register"];
      const isPublicPath = publicPaths.some((path) => nextUrl.pathname.startsWith(path));

      if (isPublicPath) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as unknown as Record<string, unknown>).role;
        token.companyId = (user as unknown as Record<string, unknown>).companyId;
        token.companyType = (user as unknown as Record<string, unknown>).companyType;
        token.activeMode = (user as unknown as Record<string, unknown>).activeMode;
        token.registrationStep = (user as unknown as Record<string, unknown>).registrationStep;
      }
      if (trigger === "update" && session) {
        if (session.companyType) {
          token.companyType = session.companyType;
        }
        if (session.activeMode) {
          if (token.companyType === "BOTH") {
            token.activeMode = session.activeMode;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? token.id) as string;
        (session as unknown as Record<string, unknown>).role = token.role;
        (session as unknown as Record<string, unknown>).companyId = token.companyId;
        (session as unknown as Record<string, unknown>).companyType = token.companyType;
        (session as unknown as Record<string, unknown>).activeMode = token.activeMode;
        (session as unknown as Record<string, unknown>).registrationStep = token.registrationStep;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
