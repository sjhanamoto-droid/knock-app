"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function login(data: { email: string; password: string }) {
  try {
    // 登録ステップを確認してリダイレクト先を決定
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: { company: { select: { registrationStep: true } } },
    });

    const step = user?.company?.registrationStep;
    const redirectTo = step != null ? "/register" : "/";

    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "メールアドレスまたはパスワードが正しくありません" };
        default:
          return { error: "ログインに失敗しました" };
      }
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
