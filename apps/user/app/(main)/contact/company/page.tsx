"use client";

import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { KnockLogoImage } from "@/components/knock-logo";

const COMPANY_INFO: { label: string; value: string }[] = [
  { label: "運営会社", value: "株式会社ディオ" },
  { label: "代表取締役", value: "三浦 洋介" },
  { label: "設立", value: "平成20年4月14日（2008年）" },
  { label: "所在地", value: "〒170-0013\n東京都豊島区東池袋4-14-5 黒柳製本ビル3階" },
];

export default function OperatingCompanyPage() {
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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">運営会社</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        <div className="rounded-2xl bg-white px-5 py-2 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <dl className="flex flex-col">
            {COMPANY_INFO.map((row, i) => (
              <div
                key={row.label}
                className={`flex flex-col gap-1 py-4 sm:flex-row sm:gap-4 ${
                  i < COMPANY_INFO.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <dt className="shrink-0 text-[13px] font-bold text-knock-text sm:w-28">
                  {row.label}
                </dt>
                <dd className="whitespace-pre-line text-[14px] leading-relaxed text-knock-text-secondary">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 製品名・ロゴ */}
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-5 py-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="text-center">
            <p className="text-[12px] font-bold text-knock-text-secondary">製品名</p>
            <p className="mt-0.5 text-[15px] font-bold text-knock-text">Knock</p>
          </div>
          <KnockLogoImage width={140} />
        </div>
      </div>
    </div>
  );
}
