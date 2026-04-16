"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMember } from "@/lib/actions/members";
import { useMode } from "@/lib/hooks/use-mode";

export default function NewMemberPage() {
  const router = useRouter();
  const { accentColor } = useMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    try {
      await createMember({
        lastName: fd.get("lastName") as string,
        firstName: fd.get("firstName") as string,
        lastNameKana: (fd.get("lastNameKana") as string) || undefined,
        firstNameKana: (fd.get("firstNameKana") as string) || undefined,
        email: fd.get("email") as string,
        password: fd.get("password") as string,
        telNumber: (fd.get("telNumber") as string) || undefined,
        role: (fd.get("role") as "REPRESENTATIVE" | "MANAGER" | "OTHER") || "OTHER",
      });
      router.push("/members");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">メンバー追加</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>
        )}

        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">姓 <span className="text-red-500">*</span></label>
                <input name="lastName" required className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">名 <span className="text-red-500">*</span></label>
                <input name="firstName" required className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">姓（カナ）</label>
                <input name="lastNameKana" className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">名（カナ）</label>
                <input name="firstNameKana" className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">メールアドレス <span className="text-red-500">*</span></label>
              <input name="email" type="email" required className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">パスワード <span className="text-red-500">*</span></label>
              <input name="password" type="password" required minLength={8} className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" placeholder="8文字以上" />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">電話番号</label>
              <input name="telNumber" type="tel" className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">権限</label>
              <select name="role" defaultValue="OTHER" className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none">
                <option value="REPRESENTATIVE">代表者</option>
                <option value="MANAGER">管理者</option>
                <option value="OTHER">一般</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-knock-orange py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "追加中..." : "メンバーを追加"}
        </button>
      </form>
    </div>
  );
}
