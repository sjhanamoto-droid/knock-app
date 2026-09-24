"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@knock/utils";
import type { HomeCardStatus } from "@/lib/actions/home";

interface Transaction {
  id: string;
  orderStatus: string | null;
  completionStatus?: string | null;
  isAdditional?: boolean;
  cardStatus: HomeCardStatus;
  amount: number;
  orderSheetId: string | null;
  viewerIsOrderer: boolean;
  siteId: string;
  siteName: string;
  parentSiteId: string | null;
  parentSiteName: string | null;
  siteStatus: string;
  address: string | null;
  startDayRequest: Date | null;
  endDayRequest: Date | null;
  ordererName: string;
  contractorName: string;
  siteInfoRoomId: string | null;
}

// 発注書ごとのステータス表示（左端の線の色・バッジ）
const CARD_STATUS_META: Record<HomeCardStatus, { label: string; barColor: string; badgeClass: string }> = {
  REQUESTED: { label: "発注依頼中", barColor: "#A855F7", badgeClass: "bg-purple-100 text-purple-700" },
  AWAITING_CONFIRM: { label: "確定待ち", barColor: "#06B6D4", badgeClass: "bg-cyan-100 text-cyan-700" },
  IN_PROGRESS: { label: "施工中", barColor: "#22C55E", badgeClass: "bg-emerald-100 text-emerald-700" },
  COMPLETED: { label: "完了", barColor: "#3B82F6", badgeClass: "bg-gray-200 text-gray-700" },
};
const CARD_STATUS_ORDER: HomeCardStatus[] = ["REQUESTED", "AWAITING_CONFIRM", "IN_PROGRESS", "COMPLETED"];

type SortKey = "updated" | "startDay" | "amountDesc";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated", label: "更新が新しい順" },
  { value: "startDay", label: "工期が近い順" },
  { value: "amountDesc", label: "金額が高い順" },
];

/** カードに表示する取引先名（自社が発注者なら受注者名、受注者なら発注者名） */
function counterpartyName(tx: Transaction): string {
  return tx.viewerIsOrderer ? tx.contractorName : tx.ordererName;
}

function formatDateShort(d: Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/* ──────────── Inline SVG Icons ──────────── */

function LocationIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M6.5 1C4.567 1 3 2.567 3 4.5C3 7.25 6.5 12 6.5 12C6.5 12 10 7.25 10 4.5C10 2.567 8.433 1 6.5 1Z"
        stroke="#9CA3AF"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="4.5" r="1.2" stroke="#9CA3AF" strokeWidth="1.2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1.5" y="2.5" width="10" height="9" rx="1.2" stroke="#9CA3AF" strokeWidth="1.2" />
      <path d="M1.5 5.5H11.5" stroke="#9CA3AF" strokeWidth="1.2" />
      <path d="M4 1.5V3.5" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 1.5V3.5" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1.5" y="5" width="10" height="7" rx="1" stroke="#9CA3AF" strokeWidth="1.2" />
      <path d="M4 5V3.5C4 2.672 4.672 2 5.5 2H7.5C8.328 2 9 2.672 9 3.5V5" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function YenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M3.5 2L6.5 6.5L9.5 2M6.5 6.5V11.5M4 7H9M4 9H9" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4 1.5H8.5L11 4V11.5C11 12.05 10.55 12.5 10 12.5H4C3.45 12.5 3 12.05 3 11.5V2.5C3 1.95 3.45 1.5 4 1.5Z" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8.5 1.5V4H11M5 7H9M5 9.5H9" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightCircle({ color }: { color: string }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: color }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M5.5 3.5L8.5 7L5.5 10.5"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* ──────────── Site Card ──────────── */

function SiteCard({
  tx,
  accentColor,
}: {
  tx: Transaction;
  accentColor: string;
}) {
  // 発注者/受注者は画面モードではなく、この取引での自社の立場で判定する
  const isOrderer = tx.viewerIsOrderer;
  const statusMeta = CARD_STATUS_META[tx.cardStatus];
  const dateStr =
    tx.startDayRequest || tx.endDayRequest
      ? `${formatDateShort(tx.startDayRequest)}${tx.startDayRequest && tx.endDayRequest ? " 〜 " : ""}${formatDateShort(tx.endDayRequest)}`
      : null;

  // メインCTA（カード下部）の決定
  let cta: { href: string; label: string } | null = null;
  if (!isOrderer && tx.orderStatus === "PENDING") {
    // 受注者: 発注依頼への回答待ち（追加工事は専用ページ・専用ラベル）
    cta = tx.isAdditional
      ? { href: `/orders/${tx.id}/additional-review`, label: "追加工事依頼に回答" }
      : { href: `/orders/${tx.id}/accept`, label: "発注依頼に回答" };
  } else if (!isOrderer && tx.siteStatus === "IN_PROGRESS") {
    // 受注者: 施工中 → 発注書ごとの施工報告を提出（提出＝完了。全て提出で工事完了）
    cta = { href: `/work-completion/${tx.siteId}`, label: "施工報告・工事完了" };
  } else if (isOrderer && tx.orderStatus === "APPROVED") {
    // 発注者: 受注者が回答済み → 発注を確定（追加工事は専用ページで確定）
    cta = tx.isAdditional
      ? { href: `/orders/${tx.id}/additional-review`, label: "追加工事を確定する" }
      : { href: `/orders/${tx.id}/confirm`, label: "発注を確定する" };
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch gap-0">
      {/* Left border accent */}
      <div className="w-1 shrink-0" style={{ backgroundColor: statusMeta.barColor }} />

      {/* Card body */}
      <div className="flex flex-1 items-center gap-2 px-3 py-3">
        <Link
          href={`/sites/${tx.siteId}`}
          className="flex flex-1 items-center gap-3 min-w-0 transition-all active:opacity-70"
        >
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            {/* Status badge + 親工事名 row */}
            <div className="flex items-center justify-between gap-2">
              <span className="flex shrink-0 items-center gap-1">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.badgeClass}`}
                >
                  {statusMeta.label}
                </span>
                {tx.isAdditional && (
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">
                    追加
                  </span>
                )}
              </span>
              {tx.parentSiteName && (
                <span className="min-w-0 flex-1 truncate text-right text-[11px] text-knock-text-secondary">
                  {tx.parentSiteName}
                </span>
              )}
            </div>

            {/* Site name */}
            <p className="truncate text-[13px] font-semibold text-knock-text">
              {tx.siteName}
            </p>

            {/* Address */}
            {tx.address && (
              <div className="flex items-center gap-1">
                <LocationIcon />
                <span className="truncate text-[11px] text-knock-text-secondary">
                  {tx.address}
                </span>
              </div>
            )}

            {/* Date range */}
            {dateStr && (
              <div className="flex items-center gap-1">
                <CalendarIcon />
                <span className="text-[11px] text-knock-text-secondary">{dateStr}</span>
              </div>
            )}

            {/* Company name */}
            {counterpartyName(tx) && (
              <div className="flex items-center gap-1">
                <CompanyIcon />
                <span className="truncate text-[11px] text-knock-text-secondary">
                  {counterpartyName(tx)}
                </span>
              </div>
            )}

            {/* 金額（この発注書の税込金額） */}
            <div className="flex items-center gap-1">
              <YenIcon />
              <span className="text-[13px] font-bold text-knock-text">
                {formatCurrency(tx.amount)}
              </span>
              <span className="text-[10px] text-knock-text-muted">（税込）</span>
            </div>
          </div>
        </Link>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Chat room button (only when site info room exists) */}
          {tx.siteInfoRoomId && (
            <Link
              href={`/chat/${tx.siteInfoRoomId}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-knock-blue transition-all active:scale-95"
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M12 7C12 9.485 9.76 11.5 7 11.5C6.174 11.5 5.393 11.333 4.694 11.033L2.5 11.5L3.262 9.68C2.78 9.016 2.5 8.232 2.5 7.393C2.5 4.908 4.74 2.893 7.5 2.893"
                  stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                />
                <circle cx="5.5" cy="7" r="0.6" fill="white" />
                <circle cx="7.5" cy="7" r="0.6" fill="white" />
                <circle cx="9.5" cy="7" r="0.6" fill="white" />
              </svg>
            </Link>
          )}

          {/* 帳票（この発注書の注文書・注文請書）。注文書が発行済みの場合のみ */}
          {tx.orderSheetId && (
            <Link
              href={`/documents/${tx.orderSheetId}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#22C55E] transition-all active:scale-95"
              aria-label="帳票を見る"
            >
              <DocumentIcon />
            </Link>
          )}

          {/* Site detail chevron */}
          <Link
            href={`/sites/${tx.siteId}`}
            className="transition-all active:scale-95"
          >
            <ChevronRightCircle color={accentColor} />
          </Link>
        </div>
      </div>
      </div>

      {/* Primary CTA */}
      {cta && (
        <Link
          href={cta.href}
          className="mx-3 mb-3 rounded-xl py-2.5 text-center text-[13px] font-bold text-white shadow-sm transition-all active:scale-[0.98]"
          style={{ backgroundColor: accentColor }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/* ──────────── Sort / Filter Sheet ──────────── */

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-h-[85vh] max-w-[430px] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom,16px)]">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h2 className="text-[16px] font-bold text-knock-text">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-4 p-4">{children}</div>
      </div>
    </>
  );
}

function Chip({
  selected,
  onClick,
  accentColor,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors"
      style={
        selected
          ? { backgroundColor: accentColor, borderColor: accentColor, color: "#fff" }
          : { backgroundColor: "#fff", borderColor: "#E5E7EB", color: "#4B5563" }
      }
    >
      {children}
    </button>
  );
}

function HeaderButton({
  onClick,
  active,
  accentColor,
  children,
}: {
  onClick: () => void;
  active: boolean;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-[12px] font-bold transition-colors active:bg-gray-50"
      style={active ? { borderColor: accentColor, color: accentColor } : { borderColor: "#E5E7EB", color: "#4B5563" }}
    >
      {children}
    </button>
  );
}

/* ──────────── Active Transactions ──────────── */

export function ActiveTransactions({
  transactions,
  allTransactions,
  accentColor,
  isOrderer,
  selectedDateStr,
}: {
  transactions: Transaction[];
  allTransactions: Transaction[];
  accentColor: string;
  isOrderer: boolean;
  selectedDateStr: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [statusFilter, setStatusFilter] = useState<HomeCardStatus | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [openSheet, setOpenSheet] = useState<"sort" | "filter" | null>(null);

  // 絞り込み候補の取引先（全取引から）
  const companies = useMemo(
    () =>
      Array.from(new Set(allTransactions.map(counterpartyName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ja")
      ),
    [allTransactions]
  );

  const visible = useMemo(() => {
    const filtered = transactions.filter(
      (tx) =>
        (!statusFilter || tx.cardStatus === statusFilter) &&
        (!companyFilter || counterpartyName(tx) === companyFilter)
    );
    if (sortKey === "updated") return filtered; // サーバーで更新日の新しい順に取得済み
    return [...filtered].sort((a, b) => {
      if (sortKey === "amountDesc") return b.amount - a.amount;
      // 工期が近い順: 開始日の昇順。未設定は最後
      const as = a.startDayRequest ? new Date(a.startDayRequest).getTime() : Infinity;
      const bs = b.startDayRequest ? new Date(b.startDayRequest).getTime() : Infinity;
      return as - bs;
    });
  }, [transactions, statusFilter, companyFilter, sortKey]);

  const count = visible.length;
  const totalCount = allTransactions.length;
  const filterCount = (statusFilter ? 1 : 0) + (companyFilter ? 1 : 0);

  return (
    <div className="flex flex-col gap-2">
      {/* Section header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-knock-text">
            {selectedDateStr} の現場
          </span>
          {count > 0 && (
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {count}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <HeaderButton onClick={() => setOpenSheet("sort")} active={sortKey !== "updated"} accentColor={accentColor}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3.5 1.5V10.5M3.5 10.5L1.5 8.5M3.5 10.5L5.5 8.5M8.5 10.5V1.5M8.5 1.5L6.5 3.5M8.5 1.5L10.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            並び替え
          </HeaderButton>
          <HeaderButton onClick={() => setOpenSheet("filter")} active={filterCount > 0} accentColor={accentColor}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 2H10.5L7 6.2V10L5 9V6.2L1.5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            絞り込み{filterCount > 0 ? `(${filterCount})` : ""}
          </HeaderButton>
        </div>
      </div>

      {/* Cards */}
      {count === 0 ? (
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-center text-[13px] text-knock-text-muted">
            {totalCount === 0
              ? `進行中の${isOrderer ? "現場" : "取引"}はありません`
              : filterCount > 0
                ? "条件に合う現場はありません"
                : "この日の現場はありません"}
          </p>
        </div>
      ) : (
        visible.map((tx) => (
          <SiteCard
            key={tx.id}
            tx={tx}
            accentColor={accentColor}
          />
        ))
      )}

      {openSheet === "sort" && (
        <BottomSheet title="並び替え" onClose={() => setOpenSheet(null)}>
          <div className="flex flex-col">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setSortKey(opt.value);
                  setOpenSheet(null);
                }}
                className="flex items-center justify-between border-b border-gray-100 py-3 text-left text-[14px] text-knock-text last:border-b-0"
              >
                {opt.label}
                {sortKey === opt.value && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5L6.5 12L13 4.5" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {openSheet === "filter" && (
        <BottomSheet title="絞り込み" onClose={() => setOpenSheet(null)}>
          <div>
            <p className="mb-2 text-[12px] font-bold text-knock-text-secondary">ステータス</p>
            <div className="flex flex-wrap gap-2">
              <Chip selected={!statusFilter} onClick={() => setStatusFilter(null)} accentColor={accentColor}>
                すべて
              </Chip>
              {CARD_STATUS_ORDER.map((st) => (
                <Chip
                  key={st}
                  selected={statusFilter === st}
                  onClick={() => setStatusFilter(st)}
                  accentColor={accentColor}
                >
                  {CARD_STATUS_META[st].label}
                </Chip>
              ))}
            </div>
          </div>
          {companies.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-bold text-knock-text-secondary">取引先</p>
              <div className="flex flex-wrap gap-2">
                <Chip selected={!companyFilter} onClick={() => setCompanyFilter(null)} accentColor={accentColor}>
                  すべて
                </Chip>
                {companies.map((name) => (
                  <Chip
                    key={name}
                    selected={companyFilter === name}
                    onClick={() => setCompanyFilter(name)}
                    accentColor={accentColor}
                  >
                    {name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setStatusFilter(null);
                setCompanyFilter(null);
              }}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-[14px] font-bold text-knock-text-secondary active:bg-gray-50"
            >
              リセット
            </button>
            <button
              type="button"
              onClick={() => setOpenSheet(null)}
              className="flex-1 rounded-xl py-3 text-[14px] font-bold text-white active:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              {count}件を表示
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
