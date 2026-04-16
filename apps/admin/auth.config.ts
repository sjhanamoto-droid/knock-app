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
      const publicPaths = ["/login", "/forgot-password", "/reset-password"];
      const isPublicPath = publicPaths.some((path) => nextUrl.pathname.startsWith(path));

      if (isPublicPath) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.roleId = (user as unknown as Record<string, unknown>).roleId;
        token.adminCompanyId = (user as unknown as Record<string, unknown>).adminCompanyId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? token.id) as string;
        (session as unknown as Record<string, unknown>).roleId = token.roleId;
        (session as unknown as Record<string, unknown>).adminCompanyId = token.adminCompanyId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
