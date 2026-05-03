"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { SideMenu } from "@/components/side-menu";
import { getDocuments, getDocumentCounterparties } from "@/lib/actions/documents";
import { getInvoiceCandidates, generateMonthlyInvoice } from "@/lib/actions/invoices";
import {
  documentTypeLabels,
  documentStatusLabels,
  documentStatusColors,
} from "@knock/utils";
import { formatCurrency } from "@knock/utils";

type DocumentFilter = "all" | "ORDER_SHEET" | "DELIVERY_NOTE" | "INVOICE";
type DocListResult = Awaited<ReturnType<typeof getDocuments>>;
type InvoiceCandidates = Awaited<ReturnType<typeof getInvoiceCandidates>>;
type Counterparty = { id: string; name: string };

const FILTER_TABS: { value: DocumentFilter; label: string }[] = [
  { value: "all", label: "全て" },
  { value: "ORDER_SHEET", label: "注文書" },
  { value: "DELIVERY_NOTE", label: "納品書" },
  { value: "INVOICE", label: "請求書" },
];

const TYPE_TITLE_MAP: Record<string, string> = {
  ORDER_SHEET: "注文書一覧",
  DELIVERY_NOTE: "納品書一覧",
  INVOICE: "請求書一覧",
};

/* ──────────── Icons ──────────── */

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M3 6H19M3 11H19M3 16H19" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 2C7.686 2 5 4.686 5 8V12L3 15H19L17 12V8C17 4.686 14.314 2 11 2Z" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 18C9 19.105 9.895 20 11 20C12.105 20 13 19.105 13 18" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1" y="2.5" width="11" height="10" rx="1.5" stroke="#9CA3AF" strokeWidth="1.2" />
      <path d="M4 1V3M9 1V3" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M1 5.5H12" stroke="#9CA3AF" strokeWidth="1.2" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1.5" y="4" width="10" height="8" rx="1" stroke="#9CA3AF" strokeWidth="1.2" />
      <path d="M4 4V2.5C4 1.948 4.448 1.5 5 1.5H8C8.552 1.5 9 1.948 9 2.5V4" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5 7H8M5 9H6.5" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/* ──────────── Helpers ──────────── */

function formatJpDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dow = days[d.getDay()];
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}(${dow})`;
}

/* ──────────── Main Page ──────────── */

export default function DocumentsPage() {
  const { accentColor } = useMode();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") as DocumentFilter | null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<DocumentFilter>(
    initialType && FILTER_TABS.some((t) => t.value === initialType) ? initialType : "all"
  );
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [result, setResult] = useState<DocListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<InvoiceCandidates>([]);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // 取引先一覧を取得
  useEffect(() => {
    getDocumentCounterparties()
      .then(setCounterparties)
      .catch(() => {});
  }, []);

  const fetchDocuments = useCallback(() => {
    setLoading(true);
    getDocuments({
      type: filter === "all" ? undefined : filter,
      yearMonth: currentMonth,
      counterpartyCompanyId: selectedCompanyId || undefined,
    })
      .then(setResult)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, currentMonth, selectedCompanyId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    getInvoiceCandidates(currentMonth)
      .then(setCandidates)
      .catch(() => {});
  }, [currentMonth]);

  const year = parseInt(currentMonth.substring(0, 4));
  const month = parseInt(currentMonth.substring(4, 6));

  function prevMonth() {
    const d = new Date(year, month - 2, 1);
    setCurrentMonth(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function nextMonth() {
    const d = new Date(year, month, 1);
    setCurrentMonth(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  async function handleGenerateInvoice(workerCompanyId: string, orderCompanyId: string) {
    const key = `${workerCompanyId}::${orderCompanyId}`;
    setGeneratingKey(key);
    try {
      await generateMonthlyInvoice(orderCompanyId, currentMonth);
      const [newCandidates] = await Promise.all([
        getInvoiceCandidates(currentMonth),
      ]);
      setCandidates(newCandidates);
      fetchDocuments();
    } catch {
      // silently ignore for now
    } finally {
      setGeneratingKey(null);
    }
  }

  // ページタイトルをフィルターに応じて変更
  const pageTitle = filter !== "all" && TYPE_TITLE_MAP[filter]
    ? TYPE_TITLE_MAP[filter]
    : "帳票一覧";

  return (
    <div className="flex flex-col">
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <MenuIcon />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
              {pageTitle}
            </h1>
            <div
              className="mt-0.5 h-[3px] w-12 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          </div>
          <Link
            href="/notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <BellIcon />
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        {/* 取引先選択 */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
            取引先
          </label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-knock-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">全ての取引先</option>
            {counterparties.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.name}
              </option>
            ))}
          </select>
        </div>

        {/* Invoice Candidates Section */}
        {candidates.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <h2 className="text-[13px] font-bold text-knock-text">請求書発行</h2>
            <p className="text-[11px] text-knock-text-secondary">
              {year}年{month}月 — 未発行の請求書候補
            </p>
            <div className="flex flex-col gap-2 mt-1">
              {candidates.map((c) => {
                const key = `${c.workerCompanyId}::${c.orderCompanyId}`;
                const isGenerating = generatingKey === key;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[12px] font-semibold text-knock-text">
                        {c.orderCompanyName} 宛
                      </span>
                      <span className="text-[10px] text-knock-text-secondary">
                        納品書 {c.deliveryNoteCount}件 /{" "}
                        <span className="font-bold" style={{ color: accentColor }}>
                          {formatCurrency(c.totalAmount)}
                        </span>
                      </span>
                    </div>
                    <button
                      onClick={() => handleGenerateInvoice(c.workerCompanyId, c.orderCompanyId)}
                      disabled={isGenerating}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: accentColor }}
                    >
                      {isGenerating ? "発行中…" : "発行"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`flex-1 rounded-lg py-2 text-[12px] font-bold transition-all ${
                filter === tab.value
                  ? "bg-white text-knock-text shadow-sm"
                  : "text-knock-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Month Navigator */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={prevMonth} className="text-[14px] text-knock-text-secondary">
            ◀
          </button>
          <span className="text-[15px] font-bold text-knock-text">
            {year}年{month}月
          </span>
          <button onClick={nextMonth} className="text-[14px] text-knock-text-secondary">
            ▶
          </button>
        </div>

        {/* Document List */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : result && result.documents.length > 0 ? (
          <div className="flex flex-col gap-3">
            {result.documents.map((doc) => {
              const counterpartyName = doc.isMyCompanyOrderer
                ? doc.workerCompanyName
                : doc.orderCompanyName;
              const dateStr = formatJpDate(doc.issuedAt);
              const amount =
                doc.totalAmount != null
                  ? `${Number(doc.totalAmount).toLocaleString("ja-JP")}円`
                  : "-";
              const docLabel =
                documentTypeLabels[doc.type] ?? doc.type;
              const docNumSuffix = doc.documentNumber.split("-").pop();
              const title = `${docLabel} #${docNumSuffix}`;

              return (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.07)] border-l-4 border-[#3B82F6] transition-all active:scale-[0.98]"
                >
                  {/* Blue top bar */}
                  <div className="relative flex h-10 items-center bg-[#3B82F6] px-3">
                    {/* PDF badge */}
                    <span className="absolute -bottom-3 left-3 flex h-7 w-12 items-center justify-center rounded-md bg-[#22C55E] text-[11px] font-bold text-white shadow-sm">
                      PDF
                    </span>
                    {/* Status badge */}
                    <span
                      className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        documentStatusColors[doc.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {documentStatusLabels[doc.status] ?? doc.status}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="flex flex-col gap-2 px-4 pt-5 pb-3">
                    {/* Title */}
                    <p className="text-[13px] font-bold leading-snug text-knock-text">
                      {title}
                    </p>

                    {/* Date row */}
                    {dateStr && (
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon />
                        <span className="text-[11px] text-knock-text-secondary">{dateStr}</span>
                      </div>
                    )}

                    {/* Company + Amount row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CompanyIcon />
                        <span className="truncate text-[11px] text-knock-text-secondary">
                          {counterpartyName ?? ""}
                        </span>
                      </div>
                      <span className="shrink-0 text-[13px] font-bold" style={{ color: accentColor }}>
                        {amount}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M24 4H10C8.9 4 8 4.9 8 6V34C8 35.1 8.9 36 10 36H30C31.1 36 32 35.1 32 34V12L24 4Z" stroke="#D1D5DB" strokeWidth="1.8" />
              <path d="M24 4V12H32" stroke="#D1D5DB" strokeWidth="1.8" />
            </svg>
            <span className="text-[13px] text-knock-text-muted">帳票がありません</span>
          </div>
        )}
      </div>
    </div>
  );
}
