"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@knock/types";
import { login } from "@/lib/actions/auth";
import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [saveCredentials, setSaveCredentials] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setError(null);
    const result = await login(data);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[430px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-12">
          {/* Logo mark: "ノック" above the K, then "nock" */}
          <div className="relative flex items-end">
            {/* Katakana above K */}
            <span
              className="absolute text-[11px] font-bold leading-none"
              style={{ color: "#F5A623", bottom: "100%", left: 0, marginBottom: "2px", letterSpacing: "0.04em" }}
            >
              ノック
            </span>
            {/* Main wordmark */}
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
            {/* "o" with orange dot overlay */}
            <span className="relative inline-flex items-end">
              <span
                className="text-[52px] font-black leading-none tracking-tight select-none"
                style={{ color: "#1A2340" }}
              >
                o
              </span>
              {/* Orange dot in the center of the "o" */}
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Server error banner */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ backgroundColor: "#FEE2E2", color: "#B91C1C" }}
            >
              {error}
            </div>
          )}

          {/* Email field */}
          <div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="メールアドレス"
              {...register("email")}
              className="w-full px-4 py-4 text-[15px] outline-none"
              style={{
                backgroundColor: "#F0F0F0",
                borderRadius: "12px",
                border: "none",
                color: "#1A2340",
              }}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password field */}
          <div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="パスワード"
              {...register("password")}
              className="w-full px-4 py-4 text-[15px] outline-none"
              style={{
                backgroundColor: "#F0F0F0",
                borderRadius: "12px",
                border: "none",
                color: "#1A2340",
              }}
            />
            {errors.password && (
              <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Save credentials checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="save-credentials"
              type="checkbox"
              checked={saveCredentials}
              onChange={(e) => setSaveCredentials(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: "#F5A623" }}
            />
            <label
              htmlFor="save-credentials"
              className="text-[13px]"
              style={{ color: "#1A2340" }}
            >
              メールアドレスとパスワードを保存する
            </label>
          </div>

          {/* Forgot password link */}
          <div className="text-center pt-1">
            <a
              href="/forgot-password"
              className="text-[13px]"
              style={{ color: "#4A90D9" }}
            >
              パスワードを忘れた方はこちら
            </a>
          </div>

          {/* Login button */}
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
                  ログイン中...
                </span>
              ) : (
                "ログイン"
              )}
            </button>
          </div>
        </form>

        {/* Registration link */}
        <div className="mt-8 text-center">
          <p className="text-[13px]" style={{ color: "#6B6B6B" }}>
            アカウントをお持ちでない方
          </p>
          <a
            href="/register"
            className="mt-2 inline-block w-full py-4 font-bold text-[16px] transition-opacity active:opacity-80"
            style={{
              color: "#F5A623",
              borderRadius: "12px",
              border: "2px solid #F5A623",
            }}
          >
            新規登録
          </a>
        </div>
      </div>
    </div>
  );
}
