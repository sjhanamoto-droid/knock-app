"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";

export default function OrdererManualPage() {
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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">発注者用マニュアル</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#F5F5F5] px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v5M12 16h.01" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke={accentColor} strokeWidth="1.6" />
          </svg>
        </div>
        <p className="text-[16px] font-bold text-knock-text">準備中です</p>
        <p className="max-w-[280px] text-[13px] leading-relaxed text-knock-text-secondary">
          発注者用マニュアルは現在準備中です。公開までしばらくお待ちください。
        </p>
        <Link
          href="/manual/contractor"
          className="mt-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white transition-all active:scale-[0.97]"
          style={{ backgroundColor: accentColor }}
        >
          受注者用マニュアルを見る
        </Link>
        <Link href="/manual" className="text-[13px] font-bold" style={{ color: accentColor }}>
          マニュアル一覧へ戻る
        </Link>
      </div>
    </div>
  );
}
