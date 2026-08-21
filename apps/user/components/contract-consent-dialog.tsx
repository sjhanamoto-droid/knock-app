"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@knock/ui";
import { SubcontractAgreementView } from "@/components/subcontract-agreement";

/**
 * つながり申請／承認時に、公示された「工事下請基本契約書」への同意を求めるダイアログ。
 * 「全文を確認する」タップでページ遷移せず、その場で全文プレビューを表示できる。
 */
export function ContractConsentDialog({
  open,
  onClose,
  onConfirm,
  title = "工事下請基本契約書への同意",
  message,
  confirmLabel = "はい（同意する）",
  processing = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: string;
  confirmLabel?: string;
  processing?: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);

  // ダイアログを閉じたらプレビューも閉じる
  useEffect(() => {
    if (!open) setShowPreview(false);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="mb-3 text-[14px] leading-relaxed text-gray-600">{message}</p>

      {/* 全文プレビューを開くボタン */}
      <button
        type="button"
        onClick={() => setShowPreview(true)}
        className="mb-5 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-colors active:bg-gray-100"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-knock-text">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 1H10L14 5V14C14 14.55 13.55 15 13 15H3C2.45 15 2 14.55 2 14V3C2 1.9 2.9 1 4 1Z" stroke="#6B6B6B" strokeWidth="1.2" fill="none" />
            <path d="M10 1V5H14" stroke="#6B6B6B" strokeWidth="1.2" fill="none" />
            <path d="M5 8.5H11M5 11H9" stroke="#6B6B6B" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          工事下請基本契約書（全文）を確認する
        </span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* はい／いいえ */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          disabled={processing}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          いいえ
        </button>
        <button
          onClick={() => onConfirm()}
          disabled={processing}
          className="flex-1 rounded-lg px-4 py-2.5 text-[14px] font-bold text-white transition-opacity active:opacity-80 disabled:opacity-60"
          style={{ backgroundColor: "#2563EB" }}
        >
          {processing ? "処理中..." : confirmLabel}
        </button>
      </div>

      {/* 全文プレビュー（ページ遷移せず全画面で重ねて表示。閉じると同意ダイアログに戻る） */}
      {showPreview && (
        <div className="fixed inset-0 z-10 flex flex-col bg-[#F5F5F5]">
          <header className="shrink-0 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
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

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
            <p className="text-[12px] text-center mb-4 leading-relaxed" style={{ color: "#9CA3AF" }}>
              本契約書は、つながりが成立した時点で発注者・受注者の双方が同意するものです。
              <br />
              会社名・契約日は、つながり成立時に自動で記載されます。
            </p>
            <SubcontractAgreementView ordererName="" contractorName="" />
          </div>

          <div className="shrink-0 bg-white px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[0_-1px_0_rgba(0,0,0,0.06)]">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: "#2563EB" }}
            >
              確認して戻る
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
