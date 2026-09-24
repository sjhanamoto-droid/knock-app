"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import {
  getInvoiceCandidates,
  generateInvoiceForWorker,
  getInvoicePreviewForWorker,
} from "@/lib/actions/invoices";
import { useToast } from "@knock/ui";
import { ALLOW_CONTRACTOR_MANUAL_CREATE } from "../billing-flags";

type Candidate = Awaited<ReturnType<typeof getInvoiceCandidates>>[number];
type InvoicePreview = Awaited<ReturnType<typeof getInvoicePreviewForWorker>>;

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
      <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  candidates: Candidate[];
  year: number;
  month: number;
}

/**
 * 締め完了・請求可能な取引先の一覧（縦一覧）。
 * 取引先をタップ → その月に合算する注文書の一覧(プレビュー) → 請求書を作成（受注者へ代理発行）。
 */
export function CandidatesClient({ candidates, year, month }: Props) {
  const router = useRouter();
  const { accentColor } = useMode();
  const { toast } = useToast();
  const yearMonth = `${year}${String(month).padStart(2, "0")}`;

  // 受注者ロール("worker")の候補は隠し、発注者ロール("orderer")のみ表示（請求書管理の件数と同じ条件）。
  const visibleCandidates = candidates.filter(
    (c) => ALLOW_CONTRACTOR_MANUAL_CREATE || c.role === "orderer"
  );

  const [pendingCandidate, setPendingCandidate] = useState<Candidate | null>(null);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // 受注会社をタップ: 合算対象の注文書一覧を取得してシートで見せる（作成はまだしない）
  async function openPreview(c: Candidate) {
    setPendingCandidate(c);
    setPreview(null);
    setPreviewLoading(true);
    try {
      setPreview(await getInvoicePreviewForWorker(c.workerCompanyId, yearMonth));
    } catch (e) {
      toast(e instanceof Error ? e.message : "請求内容の取得に失敗しました");
      setPendingCandidate(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (generating) return;
    setPendingCandidate(null);
    setPreview(null);
  }

  // 選んだ受注会社について、その月の締切済み発注を自動合算した請求書を作成する。
  async function handleGenerate() {
    if (!pendingCandidate) return;
    const c = pendingCandidate;
    setGenerating(true);
    try {
      const { id } = await generateInvoiceForWorker(c.workerCompanyId, yearMonth);
      setPendingCandidate(null);
      setPreview(null);
      router.push(`/billing/${id}?ym=${yearMonth}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "請求書の作成に失敗しました");
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-32">
      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white px-4 py-3 text-center shadow-sm">
        <button
          onClick={() => router.back()}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-1"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="#1A2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-[16px] font-bold text-[#1A2340]">請求可能な取引先</h1>
        <div className="flex justify-center mt-1">
          <WavyUnderline color={accentColor} />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="px-1">
          <p className="text-[14px] font-bold text-[#1A2340]">
            {year}年{month}月分・{visibleCandidates.length}社
          </p>
          <p className="mt-1 text-[11px] text-knock-text-secondary">
            受注会社をタップすると、その月に合算する注文書の一覧を確認してから請求書を作成できます（受注者へ代理発行）
          </p>
        </div>

        {visibleCandidates.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <p className="text-[13px] text-gray-400">
              この月に締め処理が完了した取引先はありません
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            {visibleCandidates.map((c, i) => {
              // 発注者ロールなら相手＝受注者名、受注者ロールなら相手＝発注者名を表示
              const counterparty = c.role === "orderer" ? c.workerCompanyName : c.orderCompanyName;
              return (
                <button
                  key={`${c.workerCompanyId}::${c.orderCompanyId}`}
                  onClick={() => openPreview(c)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-gray-50 ${
                    i > 0 ? "border-t border-gray-100" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-[#1A2340]">{counterparty}</p>
                    <p className="mt-0.5 text-[12px] text-knock-text-secondary">注文書 {c.orderCount}件</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[15px] font-bold" style={{ color: accentColor }}>
                      ¥{c.totalAmount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-knock-text-secondary">税込</p>
                  </div>
                  <span className="shrink-0 text-[16px] text-gray-400">›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 合算する注文書の一覧（作成前のプレビュー） */}
      {pendingCandidate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={closePreview}>
          <div
            className="flex max-h-[85vh] w-full max-w-[430px] flex-col rounded-t-3xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 pt-5 pb-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[#1A2340]">
                  「{pendingCandidate.workerCompanyName}」宛 請求書の内容
                </p>
                <p className="mt-0.5 text-[12px] text-knock-text-secondary">
                  {year}年{month}月分・以下の注文書を合算して作成します
                </p>
              </div>
              <button
                onClick={closePreview}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full active:bg-gray-100"
                aria-label="閉じる"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5">
              {previewLoading || !preview ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
                </div>
              ) : preview.orders.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-gray-400">
                  この月に合算できる注文書がありません
                </p>
              ) : (
                <div className="flex flex-col gap-2 pb-3">
                  {preview.orders.map((o) => (
                    <div key={o.orderId} className="rounded-xl bg-[#F7F7F7] px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {o.parentSiteName && (
                            <p className="truncate text-[11px] text-knock-text-secondary">{o.parentSiteName}</p>
                          )}
                          <p className="truncate text-[13px] font-bold text-[#1A2340]">{o.siteName}</p>
                          <p className="mt-0.5 text-[11px] text-knock-text-secondary">
                            {o.documentNumber}
                            {o.siteCode ? ` / 工事番号 ${o.siteCode}` : ""}
                            {o.completedDay ? ` / 完了 ${new Date(o.completedDay).toLocaleDateString("ja-JP")}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[14px] font-bold text-[#1A2340]">¥{o.totalAmount.toLocaleString()}</p>
                          <p className="text-[10px] text-knock-text-secondary">税抜 ¥{o.subtotal.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-1 flex flex-col gap-1 border-t border-gray-200 px-1 pt-3 text-[13px]">
                    <div className="flex justify-between text-knock-text-secondary">
                      <span>小計（税抜）</span>
                      <span>¥{preview.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-knock-text-secondary">
                      <span>消費税</span>
                      <span>¥{preview.taxAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[15px] font-bold text-[#1A2340]">
                      <span>合計（税込）</span>
                      <span style={{ color: accentColor }}>¥{preview.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 px-5 pb-6 pt-3">
              <button
                onClick={handleGenerate}
                disabled={generating || previewLoading || !preview || preview.orders.length === 0}
                className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {generating
                  ? "作成中..."
                  : `この${preview?.orders.length ?? 0}件で請求書を作成する`}
              </button>
              <button
                onClick={closePreview}
                disabled={generating}
                className="w-full rounded-xl py-3 text-[14px] font-bold text-knock-text-secondary active:bg-gray-50 disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
