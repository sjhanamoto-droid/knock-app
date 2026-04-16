"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/actions/password-reset";

const KnockLogo = () => (
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
);

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

    if (newPassword.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (!token) {
      setError("無効なトークンです");
      return;
    }

    setIsSubmitting(true);

    const result = await resetPassword(token, newPassword);

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
      <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[430px] flex flex-col items-center">
          <KnockLogo />
          <h1
            className="text-[20px] font-bold text-center mb-8"
            style={{ color: "#1A2340" }}
          >
            パスワードをリセット
          </h1>
          <div className="w-full space-y-6">
            <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
              無効なリンクです。パスワードリセットをもう一度お試しください。
            </div>
            <div className="text-center">
              <a
                href="/forgot-password"
                className="text-[13px]"
                style={{ color: "#6B7280" }}
              >
                ← パスワードリセットページへ
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[430px] flex flex-col items-center">
        <KnockLogo />

        <h1
          className="text-[20px] font-bold text-center mb-8"
          style={{ color: "#1A2340" }}
        >
          新しいパスワードを設定
        </h1>

        {success ? (
          <div className="w-full space-y-6">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-600">
              パスワードが正常にリセットされました。新しいパスワードでログインしてください。
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
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="newPassword"
                className="text-[13px] font-medium mb-1.5 block"
                style={{ color: "#6B7280" }}
              >
                新しいパスワード
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                placeholder="新しいパスワード"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-4 text-[15px] outline-none"
                style={{
                  backgroundColor: "#F0F0F0",
                  borderRadius: "12px",
                  border: "none",
                  color: "#1A2340",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="text-[13px] font-medium mb-1.5 block"
                style={{ color: "#6B7280" }}
              >
                パスワードを確認
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                placeholder="パスワードを確認"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                    リセット中...
                  </span>
                ) : (
                  "パスワードをリセット"
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <a
                href="/login"
                className="text-[13px]"
                style={{ color: "#6B7280" }}
              >
                ← ログインページに戻る
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[430px] flex flex-col items-center">
            <KnockLogo />
            <h1
              className="text-[20px] font-bold text-center mb-8"
              style={{ color: "#1A2340" }}
            >
              読み込み中...
            </h1>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
