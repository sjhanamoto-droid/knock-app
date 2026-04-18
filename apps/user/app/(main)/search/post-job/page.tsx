"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { createJobPosting } from "@/lib/actions/job-postings";

export default function PostJobPage() {
  const router = useRouter();
  const { accentColor } = useMode();
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [requireInvoice, setRequireInvoice] = useState(false);
  const [requireExperienceYears, setRequireExperienceYears] = useState("");
  const [compensationAmount, setCompensationAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [address, setAddress] = useState("");

  async function handleSubmit() {
    if (!title.trim()) {
      alert("タイトルを入力してください");
      return;
    }

    setSubmitting(true);
    try {
      await createJobPosting({
        title,
        description: description || undefined,
        requirements: requirements || undefined,
        requireInvoice,
        requireExperienceYears: requireExperienceYears
          ? parseInt(requireExperienceYears)
          : undefined,
        compensationAmount: compensationAmount
          ? parseInt(compensationAmount)
          : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        address: address || undefined,
      });
      router.replace("/search");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">案件を掲載する</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none"><path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-3 pb-8 bg-[#F5F5F5]">
        {/* タイトル */}
        <div>
          <label className="mb-1 block text-[13px] font-bold text-knock-text">案件タイトル *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 新築住宅 電気工事"
            className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px]"
          />
        </div>

        {/* 工期 */}
        <div>
          <label className="mb-1 block text-[13px] font-bold text-knock-text">工期</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 rounded-xl bg-[#F0F0F0] border-none px-3 py-3 text-[14px]"
            />
            <span className="text-knock-text-secondary">〜</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 rounded-xl bg-[#F0F0F0] border-none px-3 py-3 text-[14px]"
            />
          </div>
        </div>

        {/* 報酬金額 */}
        <div>
          <label className="mb-1 block text-[13px] font-bold text-knock-text">報酬金額</label>
          <input
            type="number"
            value={compensationAmount}
            onChange={(e) => setCompensationAmount(e.target.value)}
            placeholder="金額（円）※未入力の場合は応相談"
            className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px]"
          />
        </div>

        {/* 場所 */}
        <div>
          <label className="mb-1 block text-[13px] font-bold text-knock-text">場所</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="例: 東京都世田谷区〇〇1-2-3"
            className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px]"
          />
        </div>

        {/* 詳細説明 */}
        <div>
          <label className="mb-1 block text-[13px] font-bold text-knock-text">詳細説明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="工事の詳細をお書きください"
            className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px]"
          />
        </div>

        {/* 求める条件 */}
        <div>
          <label className="mb-1 block text-[13px] font-bold text-knock-text">求める条件</label>
          <label className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={requireInvoice}
              onChange={(e) => setRequireInvoice(e.target.checked)}
            />
            <span className="text-[14px]">インボイス登録済み</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[14px]">現場経験</span>
            <input
              type="number"
              value={requireExperienceYears}
              onChange={(e) => setRequireExperienceYears(e.target.value)}
              placeholder="0"
              className="w-16 rounded-lg bg-[#F0F0F0] border-none px-2 py-1 text-center text-[14px]"
            />
            <span className="text-[14px]">年以上</span>
          </div>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={2}
            placeholder="その他の条件（任意）"
            className="mt-2 w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px]"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          {submitting ? "掲載中..." : "掲載する"}
        </button>
      </div>
    </div>
  );
}
