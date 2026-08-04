"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMode } from "@/lib/hooks/use-mode";
import { getBillingList, getInvoiceCandidates } from "@/lib/actions/invoices";
import { useToast } from "@knock/ui";

type InvoiceItem = Awaited<ReturnType<typeof getBillingList>>[number];
type Candidate = Awaited<ReturnType<typeof getInvoiceCandidates>>[number];

// 受注者(worker)側からの手動作成の「入口」を一時的に非表示にするフラグ。
// false: 受注者の「締め完了・請求可能な取引先」を隠す（発注者ロールのみ表示）。
// true にすれば受注者側も再表示され、元の挙動に戻る（機能・アクションはそのまま残置）。
const ALLOW_CONTRACTOR_MANUAL_CREATE = false;

const statusLabels: Record<string, string> = {
  DRAFT: "確認待ち",
  ISSUED: "確定済み",
  CONFIRMED: "支払済み",
  VOID: "無効",
};

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "#FEF3C7", text: "#92400E" },
  ISSUED: { bg: "#DBEAFE", text: "#1E40AF" },
  CONFIRMED: { bg: "#D1FAE5", text: "#065F46" },
  VOID: { bg: "#F3F4F6", text: "#6B7280" },
};

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
      <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  initialInvoices: InvoiceItem[];
  initialCandidates: Candidate[];
  initialYear: number;
  initialMonth: number;
}

export function BillingClient({ initialInvoices, initialCandidates, initialYear, initialMonth }: Props) {
  const router = useRouter();
  const { accentColor } = useMode();
  const { toast } = useToast();

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [loading, setLoading] = useState(false);

  const isInitialMount = useRef(true);
  const yearMonth = `${selectedYear}${String(selectedMonth).padStart(2, "0")}`;

  // フラグOFFの間は受注者ロール("worker")の候補を隠し、発注者ロール("orderer")のみ表示。
  const visibleCandidates = candidates.filter(
    (c) => ALLOW_CONTRACTOR_MANUAL_CREATE || c.role === "orderer"
  );

  // 月を変えたら、その月の「締め完了の取引先」と「既存の請求書」を取得し直す
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setLoading(true);
    Promise.all([getInvoiceCandidates(yearMonth), getBillingList(yearMonth)])
      .then(([cands, invs]) => {
        setCandidates(cands);
        setInvoices(invs);
      })
      .catch(() => toast("請求情報の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [yearMonth]);

  // 月を変えたらブラウザURL(?ym)も同期し、詳細から戻った際（アプリ内の戻る・端末の戻る両方）に
  // 開いていた月を復元できるようにする。履歴を汚さないよう replaceState を使う。
  function syncMonthUrl(y: number, m: number) {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/billing?ym=${y}${String(m).padStart(2, "0")}`);
    }
  }

  function prevMonth() {
    const y = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const m = selectedMonth === 1 ? 12 : selectedMonth - 1;
    setSelectedYear(y);
    setSelectedMonth(m);
    syncMonthUrl(y, m);
  }

  function nextMonth() {
    const y = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
    const m = selectedMonth === 12 ? 1 : selectedMonth + 1;
    setSelectedYear(y);
    setSelectedMonth(m);
    syncMonthUrl(y, m);
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
        <h1 className="text-[16px] font-bold text-[#1A2340]">請求書管理</h1>
        <div className="flex justify-center mt-1">
          <WavyUnderline color={accentColor} />
        </div>
      </div>

      {/* 月選択（最初に月を選ぶ） */}
      <div className="flex items-center justify-center gap-6 py-4">
        <button onClick={prevMonth} className="rounded-full p-2 active:bg-gray-200">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="#1A2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[16px] font-bold text-[#1A2340]">
          {selectedYear}年{selectedMonth}月
        </span>
        <button onClick={nextMonth} className="rounded-full p-2 active:bg-gray-200">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 4L14 10L8 16" stroke="#1A2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-4">
          {/* 締め完了・請求可能な取引先 */}
          <div>
            <p className="px-1 pb-2 text-[13px] font-bold text-[#1A2340]">
              締め完了・請求可能な取引先
            </p>
            {visibleCandidates.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
                <p className="text-[13px] text-gray-400">
                  この月に締め処理が完了した取引先はありません
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleCandidates.map((c) => {
                  // 発注者ロールなら相手＝受注者名、受注者ロールなら相手＝発注者名を表示
                  const counterparty = c.role === "orderer" ? c.workerCompanyName : c.orderCompanyName;
                  const subLabel =
                    c.role === "orderer"
                      ? "締め完了 / 受注者へ代理発行できます"
                      : "締め完了 / 請求書を作成できます";
                  return (
                    <button
                      key={`${c.workerCompanyId}::${c.orderCompanyId}`}
                      onClick={() => router.push("/billing/new")}
                      className="flex items-center justify-between rounded-2xl bg-white px-4 py-4 text-left shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98]"
                      style={{ borderLeft: `4px solid ${accentColor}` }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-bold text-[#1A2340]">
                          {counterparty}
                        </p>
                        <p className="mt-0.5 text-[11px] text-knock-text-secondary">
                          {subLabel}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-bold" style={{ color: accentColor }}>
                        作成 ›
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* この月の請求書 */}
          <div>
            <p className="px-1 pb-2 text-[13px] font-bold text-[#1A2340]">
              この月の請求書
            </p>
            {invoices.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
                <p className="text-[13px] text-gray-400">この月の請求書はありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => {
                  const sc = statusColors[inv.status] ?? statusColors.VOID;
                  return (
                    <Link
                      key={inv.id}
                      href={`/billing/${inv.id}?ym=${yearMonth}`}
                      className="block rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-[14px] font-bold text-[#1A2340]">
                            {inv.isOrderer ? inv.workerCompany.name : inv.orderCompany.name}
                          </p>
                          <p className="text-[12px] text-knock-text-secondary mt-0.5">
                            {inv.isOrderer ? "受注者" : "発注者"} / {inv.documentNumber}
                          </p>
                        </div>
                        <span
                          className="rounded-lg px-2.5 py-1 text-[11px] font-bold"
                          style={{ backgroundColor: sc.bg, color: sc.text }}
                        >
                          {statusLabels[inv.status] ?? inv.status}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div className="text-[12px] text-knock-text-secondary">
                          {inv.dueDate && (
                            <span>支払期日: {new Date(inv.dueDate).toLocaleDateString("ja-JP")}</span>
                          )}
                        </div>
                        <p className="text-[18px] font-bold" style={{ color: accentColor }}>
                          ¥{inv.totalAmount.toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
