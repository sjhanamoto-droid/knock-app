"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { useToast, ConfirmDialog } from "@knock/ui";
import {
  getAvailableDeliveryNotes,
  createManualInvoice,
} from "@/lib/actions/invoices";

type DeliveryNote = Awaited<ReturnType<typeof getAvailableDeliveryNotes>>[number];

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
      <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  initialNotes: DeliveryNote[];
  initialYear: number;
  initialMonth: number;
}

export function NewInvoiceClient({ initialNotes, initialYear, initialMonth }: Props) {
  const router = useRouter();
  const { accentColor } = useMode();
  const { toast } = useToast();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [billingDate, setBillingDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  );

  const [notes, setNotes] = useState<DeliveryNote[]>(initialNotes);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // 当月の納品書は初期状態で全選択。月をまたいでも選択を保持するため ID の Set で管理。
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialNotes.map((n) => n.id))
  );
  // 選択済みの納品書情報を保持（合計金額計算用）
  const [selectedNotes, setSelectedNotes] = useState<Map<string, DeliveryNote>>(
    () => new Map(initialNotes.map((n) => [n.id, n]))
  );

  const isInitialMount = useRef(true);

  const yearMonth = `${selectedYear}${String(selectedMonth).padStart(2, "0")}`;

  const fetchNotes = useCallback(() => {
    setLoading(true);
    getAvailableDeliveryNotes(yearMonth)
      .then(setNotes)
      .catch(() => toast("納品書の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [yearMonth]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchNotes();
  }, [fetchNotes]);

  function prevMonth() {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  function toggleSelection(note: DeliveryNote) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(note.id)) {
        next.delete(note.id);
      } else {
        next.add(note.id);
      }
      return next;
    });
    setSelectedNotes((prev) => {
      const next = new Map(prev);
      if (next.has(note.id)) {
        next.delete(note.id);
      } else {
        next.set(note.id, note);
      }
      return next;
    });
  }

  // 表示中の月の納品書をまとめて選択/解除する
  const allCurrentSelected = notes.length > 0 && notes.every((n) => selectedIds.has(n.id));
  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      notes.forEach((n) => (allCurrentSelected ? next.delete(n.id) : next.add(n.id)));
      return next;
    });
    setSelectedNotes((prev) => {
      const next = new Map(prev);
      notes.forEach((n) => (allCurrentSelected ? next.delete(n.id) : next.set(n.id, n)));
      return next;
    });
  }

  const selectedCount = selectedIds.size;
  const selectedTotal = Array.from(selectedNotes.values()).reduce(
    (sum, n) => sum + n.totalAmount, 0
  );

  // 選択中の受注者が複数いるかチェック
  const selectedWorkerIds = new Set(
    Array.from(selectedNotes.values()).map((n) => n.workerCompanyId)
  );
  const hasMultipleWorkers = selectedWorkerIds.size > 1;

  function openConfirm() {
    if (selectedCount === 0) return;
    if (hasMultipleWorkers) {
      toast("異なる受注者の納品書が混在しています。同一受注者の納品書を選択してください");
      return;
    }
    setShowConfirm(true);
  }

  async function handleSubmit() {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const result = await createManualInvoice(
        Array.from(selectedIds),
        billingDate,
      );
      toast("請求書を発行しました");
      router.replace(`/billing/${result.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "請求書の発行に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-40">
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
        <h1 className="text-[16px] font-bold text-[#1A2340]">請求書発行</h1>
        <div className="flex justify-center mt-1">
          <WavyUnderline color={accentColor} />
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* 請求日 */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <label className="mb-2 block text-[13px] font-bold text-[#1A2340]">
            請求日
          </label>
          <input
            type="date"
            value={billingDate}
            onChange={(e) => setBillingDate(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[14px] text-[#1A2340] outline-none focus:border-blue-400"
          />
        </div>

        {/* 月フィルター */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="mb-3 text-[13px] font-bold text-[#1A2340]">
            納品書を選択
          </p>
          <div className="flex items-center justify-center gap-6">
            <button onClick={prevMonth} className="rounded-full p-2 active:bg-gray-200">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M12 4L6 10L12 16" stroke="#1A2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-[15px] font-bold text-[#1A2340]">
              {selectedYear}年{selectedMonth}月
            </span>
            <button onClick={nextMonth} className="rounded-full p-2 active:bg-gray-200">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M8 4L14 10L8 16" stroke="#1A2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {notes.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-[13px] font-bold text-[#1A2340] active:bg-gray-50"
            >
              {allCurrentSelected ? "この月をすべて解除" : "この月をすべて選択"}
            </button>
          )}
        </div>

        {/* 納品書一覧 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <p className="text-[14px] text-gray-400">この月の未請求納品書はありません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => {
              const isSelected = selectedIds.has(note.id);
              return (
                <button
                  key={note.id}
                  onClick={() => toggleSelection(note)}
                  className="flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.99]"
                  style={{
                    borderWidth: 2,
                    borderColor: isSelected ? accentColor : "transparent",
                  }}
                >
                  {/* チェックボックス */}
                  <div
                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2"
                    style={{
                      borderColor: isSelected ? accentColor : "#D1D5DB",
                      backgroundColor: isSelected ? accentColor : "transparent",
                    }}
                  >
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  {/* 納品書情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {note.parentSiteName && (
                          <p className="text-[11px] text-knock-text-secondary truncate">
                            現場名: {note.parentSiteName}
                          </p>
                        )}
                        <p className="text-[13px] font-bold text-[#1A2340] truncate">
                          {note.siteName || note.documentNumber}
                        </p>
                        <p className="text-[11px] text-knock-text-secondary mt-0.5">
                          {note.documentNumber} / {note.workerCompanyName}
                        </p>
                      </div>
                      <p className="flex-shrink-0 text-[14px] font-bold text-[#1A2340]">
                        ¥{note.totalAmount.toLocaleString()}
                      </p>
                    </div>
                    {note.issuedAt && (
                      <p className="text-[11px] text-knock-text-secondary mt-1">
                        発行日: {new Date(note.issuedAt).toLocaleDateString("ja-JP")}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 固定フッター */}
      {selectedCount > 0 && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+60px)] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-gray-200 bg-white px-4 pb-4 pt-4 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] text-knock-text-secondary">
              選択: {selectedCount}件
            </span>
            <span className="text-[18px] font-bold" style={{ color: accentColor }}>
              ¥{selectedTotal.toLocaleString()}
            </span>
          </div>
          {hasMultipleWorkers && (
            <p className="mb-2 text-center text-[12px] text-red-500">
              異なる受注者の納品書が選択されています
            </p>
          )}
          <button
            onClick={openConfirm}
            disabled={submitting || hasMultipleWorkers}
            className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? "発行中..." : "請求書を発行する"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="請求書の発行"
        message={`選択した ${selectedCount} 件の納品書（合計 ¥${selectedTotal.toLocaleString()}）を1枚の請求書にまとめて発行します。よろしいですか？`}
        confirmLabel={submitting ? "発行中..." : "発行する"}
        cancelLabel="キャンセル"
        variant="primary"
      />
    </div>
  );
}
