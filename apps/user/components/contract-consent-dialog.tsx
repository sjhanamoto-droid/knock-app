"use client";

import Link from "next/link";
import { Dialog } from "@knock/ui";

/**
 * つながり申請／承認時に、公示された「工事下請基本契約書」への同意を求めるダイアログ。
 * 「全文を確認する」タップで公示ページ（/legal/subcontract-agreement）へ遷移できる。
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
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="mb-3 text-[14px] leading-relaxed text-gray-600">{message}</p>

      {/* 全文を確認するリンク */}
      <Link
        href="/legal/subcontract-agreement"
        className="mb-5 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-colors active:bg-gray-100"
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
      </Link>

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
    </Dialog>
  );
}
