"use server";

import { prisma } from "@knock/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function requestPasswordReset(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token },
      });

      // In production, send email with reset link
      // For now, log the token to the server console
      console.log(
        `[Password Reset] Token for ${email}: ${token}`
      );
      console.log(
        `[Password Reset] Reset URL: /reset-password?token=${token}`
      );
    }

    // Always return success to avoid revealing whether the email exists
    return {
      success: true,
      message:
        "ご登録のメールアドレスにパスワードリセットのリンクを送信しました。メールをご確認ください。",
    };
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    return {
      success: false,
      message: "エラーが発生しました。もう一度お試しください。",
    };
  }
}

export async function resetPassword(token: string, newPassword: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { resetToken: token },
    });

    if (!user) {
      return { error: "無効なトークンです" };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    return { error: "エラーが発生しました。もう一度お試しください。" };
  }
}
