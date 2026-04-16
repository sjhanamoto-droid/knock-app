"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/actions/password-reset";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const result = await requestPasswordReset(email);
    setMessage(result.message);
    setSubmitted(true);
    setIsSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[430px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-12">
          <div className="relative flex items-end">
            <span
              className="absolute text-[11px] font-bold leading-none"
              style={{ color: "#F5A623", bottom: "100%", left: 0, marginBottom: "2px", letterSpacing: "0.04em" }}
            >
              ノック
            </span>
            <span
              className="text-[52px] font-black leading-none tracking-tight select-none"
              style={{ color: "#1A2340" }}
            >
              K
            </span>
            <span
              className="text-[52px] font-black leading-none tracking-tight select-none"
              style={{ color: "#1A2340" }}
            >
              n
            </span>
            <span className="relative inline-flex items-end">
              <span
                className="text-[52px] font-black leading-none tracking-tight select-none"
                style={{ color: "#1A2340" }}
              >
                o
              </span>
              <span
                className="absolute rounded-full"
                style={{
                  width: "10px",
                  height: "10px",
                  backgroundColor: "#F5A623",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -45%)",
                }}
              />
            </span>
            <span
              className="text-[52px] font-black leading-none tracking-tight select-none"
              style={{ color: "#1A2340" }}
            >
              ck
            </span>
          </div>
        </div>

        {/* Title */}
        <h1
          className="text-[20px] font-bold text-center mb-8"
          style={{ color: "#1A2340" }}
        >
          パスワードをリセット
        </h1>

        {submitted ? (
          <div className="space-y-6">
            <div
              className="rounded-xl px-4 py-3 text-[13px]"
              style={{ backgroundColor: "#D1FAE5", color: "#059669" }}
            >
              {message}
            </div>
            <div className="text-center">
              <a
                href="/login"
                className="text-[13px]"
                style={{ color: "#6B7280" }}
              >
                ← ログインページに戻る
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] text-center mb-6" style={{ color: "#6B7280" }}>
              ご登録のメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-[13px] font-medium mb-1.5" style={{ color: "#6B7280" }}>
                  メールアドレス
                </p>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="メールアドレス"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-4 text-[15px] outline-none"
                  style={{
                    backgroundColor: "#F0F0F0",
                    borderRadius: "12px",
                    border: "none",
                    color: "#1A2340",
                  }}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 text-white font-bold text-[16px] transition-opacity"
                  style={{
                    backgroundColor: "#F5A623",
                    borderRadius: "12px",
                    border: "none",
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      送信中...
                    </span>
                  ) : (
                    "リセットリンクを送信"
                  )}
                </button>
              </div>
            </form>

            <div className="text-center pt-2">
              <a
                href="/login"
                className="text-[13px]"
                style={{ color: "#6B7280" }}
              >
                ← ログインページに戻る
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
