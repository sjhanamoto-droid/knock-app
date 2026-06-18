"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";

export default function ManualPage() {
  const router = useRouter();
  const { accentColor } = useMode();

  const cards = [
    {
      href: "/manual/contractor",
      title: "受注者用マニュアル",
      desc: "発注を受ける方（施工会社）向け。つながり申請・発注依頼・注文書・追加工事・工事完了までの操作を解説します。",
      ready: true,
    },
    {
      href: "/manual/orderer",
      title: "発注者用マニュアル",
      desc: "発注する方向け。現場・プロジェクトの作成から発注、工事完了の承認、請求までの操作を解説します。",
      ready: false,
    },
  ];

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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">マニュアル</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-4 pb-8">
        <p className="text-[13px] text-knock-text-secondary">
          ご利用の立場に合わせてマニュアルをお選びください。
        </p>

        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="block rounded-2xl bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98]"
            style={{ borderLeft: `4px solid ${c.ready ? accentColor : "#D1D5DB"}` }}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-bold text-knock-text">{c.title}</h2>
              {c.ready ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: accentColor }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3L9 7L5 11" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500">
                  準備中
                </span>
              )}
            </div>
            <p className="text-[13px] leading-relaxed text-knock-text-secondary">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
