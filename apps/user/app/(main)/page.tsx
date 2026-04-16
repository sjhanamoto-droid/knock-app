"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SideMenu } from "@/components/side-menu";
import { useMode } from "@/lib/hooks/use-mode";
import { getActiveTransactions, getMonthlySummary, getHomeBadgeCounts } from "@/lib/actions/home";
import { ActiveTransactions } from "@/components/home/active-transactions";
import { MonthlySummary } from "@/components/home/monthly-summary";
import KycPrompt from "@/components/kyc-prompt";

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

/* ──────────── Wavy Underline SVG ──────────── */

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
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
  // Build a 7-day week centered on selectedDate's week (Mon–Sun)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get Monday of the week containing selectedDate
  const base = new Date(selectedDate);
  base.setHours(0, 0, 0, 0);
  const dow = base.getDay(); // 0=Sun
  // Week starts Sunday
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
            <div
              key={label}
              className="flex flex-col items-center"
            >
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

/* ──────────── Types ──────────── */

type TransactionItem = Awaited<ReturnType<typeof getActiveTransactions>>[number];
type SummaryData = Awaited<ReturnType<typeof getMonthlySummary>>;

/* ──────────── Main Page ──────────── */

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({ count: 0, amount: 0, isOrderer: false });
  const [badgeCounts, setBadgeCounts] = useState({ notifications: 0, chats: 0 });
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const { accentColor, isOrderer } = useMode();

  useEffect(() => {
    Promise.all([
      getActiveTransactions(),
      getMonthlySummary(),
      getHomeBadgeCounts(),
    ])
      .then(([t, s, b]) => {
        setTransactions(t);
        setSummary(s);
        setBadgeCounts(b);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalBadge = badgeCounts.notifications + badgeCounts.chats;

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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
              ホーム
            </h1>
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
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
          {/* KYC未完了バナー */}
          <KycPrompt />

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
      )}
    </div>
  );
}
