"use client";

import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";

const rows = [
  { label: "販売事業者", value: "株式会社Knock" },
  { label: "所在地", value: "（準備中）" },
  { label: "代表者", value: "（準備中）" },
  { label: "連絡先", value: "info@knock-app.jp" },
  { label: "サービス名", value: "Knock" },
  { label: "サービス内容", value: "建設業向けマッチングプラットフォーム" },
  {
    label: "料金",
    value:
      "フリープラン 0円 / スタンダードプラン 4,980円（税抜）/月 / プロプラン 9,800円（税抜）/月",
  },
  { label: "支払方法", value: "クレジットカード" },
  {
    label: "返品・キャンセル",
    value: "デジタルサービスのため返品不可。解約は随時可能。",
  },
];

export default function LegalPage() {
  const router = useRouter();
  const { accentColor } = useMode();

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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">特定商取引に基づく表記</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          <dl>
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`flex gap-3 px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""}`}
              >
                <dt className="w-[100px] shrink-0 text-[12px] font-bold text-knock-text-muted pt-0.5">
                  {row.label}
                </dt>
                <dd className="flex-1 text-[13px] leading-relaxed text-knock-text">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
