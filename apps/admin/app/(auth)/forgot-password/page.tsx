"use client";

import { useState } from "react";
import { requestAdminPasswordReset } from "@/lib/actions/password-reset";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const result = await requestAdminPasswordReset(email);
    setMessage(result.message);
    setSubmitted(true);
    setIsSubmitting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1A1A1A]">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-knock-orange text-[22px] font-bold text-white shadow-lg">K</div>
          <h1 className="mt-4 text-[24px] font-bold text-gray-900">Knock Admin</h1>
          <p className="mt-2 text-[14px] text-gray-500">パスワードリセット</p>
        </div>

        {submitted ? (
          <div className="space-y-6">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-600">
              {message}
            </div>
            <div className="text-center">
              <a
                href="/login"
                className="text-[13px] text-knock-orange hover:text-knock-amber"
              >
                ログインページに戻る
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-[13px] font-semibold text-gray-700"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-knock-orange/30 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-knock-orange px-4 py-3 text-[14px] font-bold text-white hover:bg-knock-amber transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "送信中..." : "リセットリンクを送信"}
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
        )}
      </div>
    </div>
  );
}
