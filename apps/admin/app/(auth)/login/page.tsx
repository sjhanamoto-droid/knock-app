"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@knock/types";
import { login } from "@/lib/actions/auth";
import { useState } from "react";

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null);
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
    <div className="flex min-h-screen items-center justify-center bg-[#1A1A1A]">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-knock-orange text-[22px] font-bold text-white shadow-lg">K</div>
          <h1 className="mt-4 text-[24px] font-bold text-gray-900">Knock Admin</h1>
          <p className="mt-2 text-[14px] text-gray-500">管理者ログイン</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-[13px] font-semibold text-gray-700">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className="mt-1 block w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-knock-orange/30 focus:outline-none"
            />
            {errors.email && (
              <p className="mt-1 text-[13px] text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-[13px] font-semibold text-gray-700">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="mt-1 block w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-knock-orange/30 focus:outline-none"
            />
            {errors.password && (
              <p className="mt-1 text-[13px] text-red-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-knock-orange px-4 py-3 text-[14px] font-bold text-white hover:bg-knock-amber transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "ログイン中..." : "ログイン"}
          </button>

          <div className="text-center">
            <a href="/forgot-password" className="text-[13px] text-knock-orange hover:text-knock-amber">
              パスワードをお忘れですか？
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
