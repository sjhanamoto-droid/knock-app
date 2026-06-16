"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// リセットトークンの有効期限（1時間）。
// 専用カラムを追加せず、トークン文字列に "ランダム.失効時刻" の形で失効時刻を埋め込む。
// DB は完全一致で引くため、失効時刻の改ざんは照合不一致となり成立しない。
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function requestPasswordReset(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;
      const token = `${crypto.randomBytes(32).toString("hex")}.${expiresAt}`;

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token },
      });

      // TODO: 実運用ではメール送信プロバイダ（Resend/SES等）で送信する。
      // 現状は未整備のためサーバログにのみ出力（配信は別途プロバイダ選定が必要）。
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

    // 失効時刻を検証。期限切れならトークンを破棄して拒否。
    const expiresAt = Number(token.split(".")[1]);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: null },
      });
      return { error: "トークンの有効期限が切れています。お手数ですが再度お試しください。" };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null, // 単回使用: 使用後に破棄
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    return { error: "エラーが発生しました。もう一度お試しください。" };
  }
}
