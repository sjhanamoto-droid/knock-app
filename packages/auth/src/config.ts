import type { NextAuthConfig } from "next-auth";

export const baseAuthConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
};
