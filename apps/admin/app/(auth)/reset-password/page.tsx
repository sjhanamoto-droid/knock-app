"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resetAdminPassword } from "@/lib/actions/password-reset";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (newPassword.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }

    if (!token) {
      setError("無効なトークンです");
      return;
    }

    setIsSubmitting(true);

    const result = await resetAdminPassword(token, newPassword);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
    } else {
      setSuccess(true);
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
          無効なリセットリンクです。もう一度パスワードリセットをお試しください。
        </div>
        <div className="text-center">
          <a
            href="/forgot-password"
            className="text-[13px] text-knock-orange hover:text-knock-amber"
          >
            パスワードリセットページへ
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-600">
          パスワードが正常にリセットされました。
        </div>
        <div className="text-center">
          <a
            href="/login"
            className="text-[13px] text-knock-orange hover:text-knock-amber"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="newPassword"
          className="block text-[13px] font-semibold text-gray-700"
        >
          新しいパスワード
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-1 block w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-knock-orange/30 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-[13px] font-semibold text-gray-700"
        >
          新しいパスワード（確認）
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 block w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-knock-orange/30 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-knock-orange px-4 py-3 text-[14px] font-bold text-white hover:bg-knock-amber transition-colors disabled:opacity-50"
      >
        {isSubmitting ? "リセット中..." : "パスワードをリセット"}
      </button>

      <div className="text-center">
        <a
          href="/login"
          className="text-[13px] text-knock-orange hover:text-knock-amber"
        >
          ログインページに戻る
        </a>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1A1A1A]">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-knock-orange text-[22px] font-bold text-white shadow-lg">K</div>
          <h1 className="mt-4 text-[24px] font-bold text-gray-900">Knock Admin</h1>
          <p className="mt-2 text-[14px] text-gray-500">新しいパスワードを設定</p>
        </div>

        <Suspense
          fallback={
            <div className="text-center text-[14px] text-gray-500">
              読み込み中...
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
