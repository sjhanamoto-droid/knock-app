"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useMode } from "@/lib/hooks/use-mode";
import { searchJobs, getOccupationOptions } from "@/lib/actions/job-search";
import { formatCurrency } from "@knock/utils";
import { SideMenu } from "@/components/side-menu";

type JobSearchResult = Awaited<ReturnType<typeof searchJobs>>;
type OccupationOption = Awaited<ReturnType<typeof getOccupationOptions>>[number];

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="#9CA3AF" strokeWidth="1.4" />
      <path d="M10.5 10.5L13.5 13.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1C4.567 1 3 2.567 3 4.5C3 7 6.5 12 6.5 12C6.5 12 10 7 10 4.5C10 2.567 8.433 1 6.5 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.5" cy="4.5" r="1.2" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1.5" y="2.5" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 1.5V3.5M9 1.5V3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1.5 5.5H11.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function YenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M3 2L6.5 7M10 2L6.5 7M6.5 7V11M4.5 8.5H8.5M4.5 10H8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="2" y="3" width="9" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 11.5V8.5H8V11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 5.5H5.5M7.5 5.5H8.5M4.5 7.5H5.5M7.5 7.5H8.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M4 3V1.5H9V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1.5L7.9 5H11.5L8.6 7.2L9.7 11L6.5 8.9L3.3 11L4.4 7.2L1.5 5H5.1L6.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptySearchIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="21" cy="21" r="13" stroke="#D1D5DB" strokeWidth="2.5" />
      <path d="M30.5 30.5L40 40" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 21H26M21 16V26" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ──────────── Main Page ──────────── */

export default function JobsPage() {
  const { accentColor } = useMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [result, setResult] = useState<JobSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [occupationId, setOccupationId] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [occupations, setOccupations] = useState<OccupationOption[]>([]);

  useEffect(() => {
    getOccupationOptions().then(setOccupations).catch(() => {});
  }, []);

  const loadJobs = useCallback(() => {
    setLoading(true);
    searchJobs({
      keyword: keyword || undefined,
      occupationSubItemId: occupationId || undefined,
      prefecture: prefecture || undefined,
    })
      .then(setResult)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [keyword, occupationId, prefecture]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadJobs();
  }

  function formatDateRange(start: Date | null, end: Date | null): string {
    if (!start) return "日程未定";
    const s = new Date(start).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
    if (!end) return `${s}〜`;
    const e = new Date(end).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
    const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${s}〜${e} (${days}日間)`;
  }

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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">案件を探す</h1>
            <WavyUnderline color={accentColor} />
          </div>

          <Link
            href="/notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <BellIcon />
          </Link>
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="flex flex-col gap-3 bg-[#F5F5F5] px-4 pt-3 pb-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="キーワードで検索..."
              className="w-full rounded-full border-none bg-[#F0F0F0] py-3 pl-9 pr-4 text-[14px] outline-none placeholder:text-gray-400"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-full px-5 py-3 text-[13px] font-bold text-white"
            style={{ backgroundColor: accentColor }}
          >
            検索
          </button>
        </form>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={occupationId}
            onChange={(e) => setOccupationId(e.target.value)}
            className="flex-1 rounded-xl border-none bg-[#F0F0F0] px-3 py-2.5 text-[13px] text-knock-text outline-none"
          >
            <option value="">職種を選択</option>
            {occupations.map((occ) => (
              <option key={occ.id} value={occ.id}>
                {occ.majorName} / {occ.name}
              </option>
            ))}
          </select>
          <select
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            className="flex-1 rounded-xl border-none bg-[#F0F0F0] px-3 py-2.5 text-[13px] text-knock-text outline-none"
          >
            <option value="">都道府県</option>
            {PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>{pref}</option>
            ))}
          </select>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : result && result.jobs.length > 0 ? (
          <>
            <p className="text-[13px] text-knock-text-secondary">
              {result.total}件の案件が見つかりました
            </p>
            <div className="flex flex-col gap-2.5">
              {result.jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center rounded-2xl border-l-4 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98]"
                  style={{ borderLeftColor: accentColor }}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-semibold text-knock-text">{job.title}</h3>
                    <div className="mt-2 flex flex-col gap-1 text-[12px] text-knock-text-secondary">
                      {job.address && (
                        <span className="flex items-center gap-1.5">
                          <LocationIcon />
                          {job.address}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <CalendarIcon />
                        {formatDateRange(job.startDate, job.endDate)}
                      </span>
                      {job.compensationAmount && (
                        <span className="flex items-center gap-1.5">
                          <YenIcon />
                          {formatCurrency(job.compensationAmount)}
                        </span>
                      )}
                      <div className="mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1.5">
                          <BuildingIcon />
                          {job.companyName}
                        </span>
                        {job.trustScore != null ? (
                          <span className="flex items-center gap-1 text-amber-600">
                            <StarIcon />
                            {job.trustScore.toFixed(1)} ({job.totalTransactions}件)
                          </span>
                        ) : (
                          <span className="text-knock-text-muted">新規</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    <ChevronRightIcon />
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10">
            <EmptySearchIcon />
            <span className="text-[13px] text-knock-text-muted">
              条件に合う案件がありません
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
