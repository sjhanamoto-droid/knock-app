"use server";

import { prisma } from "@knock/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function requestAdminPasswordReset(email: string) {
  try {
    const adminUser = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (adminUser) {
      const token = crypto.randomBytes(32).toString("hex");

      await prisma.adminUser.update({
        where: { id: adminUser.id },
        data: { resetToken: token },
      });

      // In production, send email with reset link
      // For now, log token to console
      console.log(`[Password Reset] Admin: ${email}, Token: ${token}`);
      console.log(
        `[Password Reset] Reset URL: /reset-password?token=${token}`
      );
    }

    // Always return success to avoid revealing whether email exists
    return {
      success: true,
      message:
        "メールアドレスが登録されている場合、パスワードリセットのメールを送信しました。",
    };
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    return {
      success: true,
      message:
        "メールアドレスが登録されている場合、パスワードリセットのメールを送信しました。",
    };
  }
}

export async function resetAdminPassword(token: string, newPassword: string) {
  try {
    const adminUser = await prisma.adminUser.findFirst({
      where: { resetToken: token },
    });

    if (!adminUser) {
      return { error: "無効なトークンです" };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: {
        password: hashedPassword,
        resetToken: null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    return { error: "パスワードのリセットに失敗しました" };
  }
}
