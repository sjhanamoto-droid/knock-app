"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// リセットトークンの有効期限（1時間）。
// 専用カラムを追加せず、トークン文字列に "ランダム.失効時刻" の形で失効時刻を埋め込む。
// DB は完全一致で引くため、失効時刻の改ざんは照合不一致となり成立しない。
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function requestAdminPasswordReset(email: string) {
  try {
    const adminUser = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (adminUser) {
      const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
      const token = `${crypto.randomBytes(32).toString("hex")}.${expiresAt}`;

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

    // 失効時刻を検証。期限切れならトークンを破棄して拒否。
    const expiresAt = Number(token.split(".")[1]);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      await prisma.adminUser.update({
        where: { id: adminUser.id },
        data: { resetToken: null },
      });
      return { error: "トークンの有効期限が切れています。お手数ですが再度お試しください。" };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: {
        password: hashedPassword,
        resetToken: null, // 単回使用: 使用後に破棄
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    return { error: "パスワードのリセットに失敗しました" };
  }
}
