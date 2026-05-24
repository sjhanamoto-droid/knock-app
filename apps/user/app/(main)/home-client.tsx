"use client";

import { useState } from "react";
import Link from "next/link";
import { SideMenu } from "@/components/side-menu";
import { useMode } from "@/lib/hooks/use-mode";
import { ActiveTransactions } from "@/components/home/active-transactions";
import { MonthlySummary } from "@/components/home/monthly-summary";
import type { getActiveTransactions, getMonthlySummary, getHomeBadgeCounts } from "@/lib/actions/home";

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

/* ──────────── Calendar Week View ──────────── */

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function CalendarWeekView({
  selectedDate,
  onSelectDate,
  accentColor,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  accentColor: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const base = new Date(selectedDate);
  base.setHours(0, 0, 0, 0);
  const dow = base.getDay();
  const startOfWeek = new Date(base);
  startOfWeek.setDate(base.getDate() - dow);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push(d);
  }

  const yearMonth = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月`;

  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <p className="mb-2 text-[13px] font-bold text-knock-text">{yearMonth}</p>
      <div className="grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map((label, i) => {
          const isSun = i === 0;
          const isSat = i === 6;
          return (
            <div key={label} className="flex flex-col items-center">
              <span
                className="mb-1 text-[10px] font-semibold"
                style={{ color: isSun ? "#EF4444" : isSat ? "#3B82F6" : "#6B6B6B" }}
              >
                {label}
              </span>
              <button
                type="button"
                onClick={() => onSelectDate(days[i])}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold transition-colors"
                style={
                  days[i].getTime() === new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime()
                    ? { backgroundColor: accentColor, color: "#fff" }
                    : days[i].getTime() === today.getTime()
                    ? { color: accentColor, fontWeight: 700 }
                    : { color: "#1A1A1A" }
                }
              >
                {days[i].getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────── KYC Banner ──────────── */

function KycBanner({ step }: { step: number }) {
  const stepLabel =
    step === 1
      ? "会社情報の登録"
      : step === 2
        ? "個人情報の登録"
        : "登録の完了";
  const href = step === 1 ? "/mypage/company" : "/mypage/edit";

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-[13px] font-bold text-amber-800">登録が完了していません</p>
      <p className="mt-1 text-[12px] text-amber-700">
        案件への応募や発注を行うには、{stepLabel}が必要です。
      </p>
      <Link
        href={href}
        className="mt-2 inline-block rounded-lg bg-amber-600 px-4 py-2 text-[12px] font-bold text-white"
      >
        登録を続ける
      </Link>
    </div>
  );
}

/* ──────────── Types ──────────── */

type TransactionItem = Awaited<ReturnType<typeof getActiveTransactions>>[number];
type SummaryData = Awaited<ReturnType<typeof getMonthlySummary>>;
type BadgeCounts = Awaited<ReturnType<typeof getHomeBadgeCounts>>;

/* ──────────── Props ──────────── */

interface HomeClientProps {
  transactions: TransactionItem[];
  summary: SummaryData;
  badgeCounts: BadgeCounts;
  kycStep: number | null;
}

/* ──────────── Main Client Component ──────────── */

export function HomeClient({ transactions, summary, badgeCounts, kycStep }: HomeClientProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const { accentColor, isOrderer } = useMode();

  const totalBadge = badgeCounts.notifications;

  // Filter transactions for selected date
  const selectedDateStr = `${selectedDate.getMonth() + 1}/${selectedDate.getDate()}`;
  const filteredTransactions = transactions.filter((tx) => {
    if (!tx.startDayRequest && !tx.endDayRequest) return true;
    const start = tx.startDayRequest ? new Date(tx.startDayRequest) : null;
    const end = tx.endDayRequest ? new Date(tx.endDayRequest) : null;
    if (start && end) {
      return selectedDate >= start && selectedDate <= end;
    }
    if (start) {
      const s = new Date(start);
      s.setHours(0, 0, 0, 0);
      return selectedDate.getTime() === s.getTime();
    }
    return true;
  });

  return (
    <div className="flex flex-col">
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <MenuIcon />
          </button>

          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">ホーム</h1>
            <div className="mt-1 h-[2px] w-10 rounded-full" style={{ backgroundColor: accentColor }} />
          </div>

          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <BellIcon />
            {totalBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-knock-red text-[9px] font-bold text-white">
                {totalBadge > 9 ? "9+" : totalBadge}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        {/* KYC未完了バナー */}
        {kycStep != null && <KycBanner step={kycStep} />}

        {/* カレンダー週ビュー */}
        <CalendarWeekView
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          accentColor={accentColor}
        />

        {/* 現場カード一覧 */}
        <ActiveTransactions
          transactions={filteredTransactions}
          allTransactions={transactions}
          accentColor={accentColor}
          isOrderer={isOrderer}
          selectedDateStr={selectedDateStr}
        />

        {/* 今月のサマリー */}
        <MonthlySummary
          summary={summary}
          accentColor={accentColor}
          isOrderer={isOrderer}
        />
      </div>
    </div>
  );
}
