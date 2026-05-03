"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";

export default function ContactPage() {
  const router = useRouter();
  const { accentColor } = useMode();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    window.alert("送信しました");
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[14px] text-knock-text placeholder:text-gray-400 outline-none focus:border-gray-400 transition-colors";

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">お問い合わせ</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        <div className="rounded-2xl bg-white px-5 py-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-knock-text">
                お名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="山田 太郎"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-knock-text">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-knock-text">
                件名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="ご要望・ご質問の件名を入力してください"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-bold text-knock-text">
                お問い合わせ内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={5}
                placeholder="お問い合わせ内容を入力してください"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: accentColor }}
            >
              送信する
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
