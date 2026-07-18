"use client";

import { useRouter } from "next/navigation";
import { SubcontractAgreementView } from "@/components/subcontract-agreement";

/**
 * 公示用の「工事下請基本契約書」全文ページ（会社名・契約日は空欄のテンプレート）。
 * つながり申請／承認の同意ダイアログから遷移して全文を確認するために使う。
 */
export default function PublishedSubcontractAgreementPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#F5F5F5]">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[16px] font-bold tracking-wide text-knock-text">工事下請基本契約書</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* 本文 */}
      <div className="px-4 pt-4 pb-10">
        <p className="text-[12px] text-center mb-4 leading-relaxed" style={{ color: "#9CA3AF" }}>
          本契約書は、つながりが成立した時点で発注者・受注者の双方が同意するものです。
          <br />
          会社名・契約日は、つながり成立時に自動で記載されます。
        </p>
        <SubcontractAgreementView ordererName="" contractorName="" />
      </div>
    </div>
  );
}
