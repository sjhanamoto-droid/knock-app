"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { searchContractors } from "@/lib/actions/contractors";
import { getOccupationMasters } from "@/lib/actions/occupations";
import { searchJobsWithLocation, searchContractorsWithLocation } from "@/lib/actions/map-search";
import { SideMenu } from "@/components/side-menu";
import { useMode } from "@/lib/hooks/use-mode";

const SearchMap = dynamic(() => import("@/components/search-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
    </div>
  ),
});

type Contractor = Awaited<ReturnType<typeof searchContractors>>[number];
type MajorItem = Awaited<ReturnType<typeof getOccupationMasters>>[number];
type JobPin = Awaited<ReturnType<typeof searchJobsWithLocation>>[number];
type ContractorPin = Awaited<ReturnType<typeof searchContractorsWithLocation>>[number];

type ViewMode = "list" | "map";

const PREFECTURES = [
  "東京都",
  "千葉県",
  "埼玉県",
  "神奈川県",
  "栃木県",
  "茨城県",
] as const;

/* ─── Icons ─── */

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M3 6H19M3 11H19M3 16H19"
        stroke="#1A1A1A"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M11 2C7.686 2 5 4.686 5 8V12L3 15H19L17 12V8C17 4.686 14.314 2 11 2Z"
        stroke="#1A1A1A"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 18C9 19.105 9.895 20 11 20C12.105 20 13 19.105 13 18"
        stroke="#1A1A1A"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="6" r="4" fill="white" />
      <circle
        cx="16"
        cy="6"
        r="3.5"
        stroke="#1A1A1A"
        strokeWidth="1.2"
      />
      <path
        d="M14 8L18 4"
        stroke="#1A1A1A"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M4 3H14C14.55 3 15 3.45 15 4V16L9 13L3 16V4C3 3.45 3.45 3 4 3Z"
        stroke="#D1D5DB"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M7 1C4.791 1 3 2.791 3 5C3 7.5 7 13 7 13C7 13 11 7.5 11 5C11 2.791 9.209 1 7 1Z"
        fill="#EF4444"
        stroke="#EF4444"
        strokeWidth="0.5"
      />
      <circle cx="7" cy="5" r="1.5" fill="white" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M8.5 2C9.9 2 11 3.1 11 4.5C11 5.1 10.78 5.65 10.42 6.08L11.5 7.16C11.82 7.48 11.82 7.99 11.5 8.31L8.31 11.5C7.99 11.82 7.48 11.82 7.16 11.5L6.08 10.42C5.65 10.78 5.1 11 4.5 11C3.1 11 2 9.9 2 8.5C2 7.1 3.1 6 4.5 6C4.74 6 4.97 6.035 5.18 6.1L8.5 2.78C8.5 2.52 8.5 2.26 8.5 2Z"
        stroke="#6B7280"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="4.5" r="2" stroke="#6B7280" strokeWidth="1.1" />
      <path
        d="M2.5 12C2.5 9.791 4.567 8 7 8C9.433 8 11.5 9.791 11.5 12"
        stroke="#6B7280"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Week Calendar ─── */

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function WeekCalendar({ contractor }: { contractor: Contractor }) {
  // Build 7-day window starting from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  // Reorder so it starts with 金(Friday=5) as shown in Figma
  // Actually show the real next 7 days starting Monday-style
  // Show days sorted: 金土日月火水木 = starting from nearest Friday
  // Per Figma: just show 7 consecutive days with day-of-week header
  const startDow = days[0].getDay(); // today's day of week

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const dow = d.getDay();
          const date = d.getDate();
          const isToday = i === 0;
          const isSun = dow === 0;
          const isSat = dow === 6;

          // Color for today = orange highlight, otherwise blue for weekdays
          let circleClass = "bg-blue-100 text-blue-600";
          if (isToday) circleClass = "bg-orange-400 text-white";

          let dowColor = "text-gray-500";
          if (isSun) dowColor = "text-red-400";
          if (isSat) dowColor = "text-blue-400";

          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <span className={`text-[9px] font-medium ${dowColor}`}>
                {DOW_LABELS[dow]}
              </span>
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full ${circleClass}`}
              >
                <span className="text-[10px] font-semibold">{date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Contractor Card ─── */

function ContractorCard({ c }: { c: Contractor }) {
  const areas = c.areas.map((a) => a.area?.name).filter(Boolean);
  const occupationNames = c.occupations
    .slice(0, 4)
    .map((o) => o.occupationSubItem?.name)
    .filter(Boolean);

  return (
    <Link
      href={`/search/${c.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-3 transition-colors active:bg-gray-50"
    >
      {/* Top row: logo + name/bookmark */}
      <div className="flex gap-3">
        {/* Logo */}
        {c.logo ? (
          <img
            src={c.logo}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[18px] font-bold text-gray-400">
            {c.name?.charAt(0) ?? "?"}
          </div>
        )}

        {/* Right side */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="text-[14px] font-bold leading-tight text-gray-900">
              {c.name ?? "名称未設定"}
            </p>
            <div className="shrink-0">
              <BookmarkIcon />
            </div>
          </div>

          {/* Connection badge */}
          {c.isConnected && (
            <span className="mt-0.5 inline-block rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600">
              つながり済
            </span>
          )}
          {c.connectionStatus === "pending" && (
            <span className="mt-0.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              リクエスト中
            </span>
          )}
        </div>
      </div>

      {/* Description placeholder — selfIntro not in list query, show prefecture+city */}
      {(c.prefecture || c.city) && (
        <p className="mt-2 text-[12px] leading-relaxed text-gray-500">
          {c.prefecture}
          {c.city}
        </p>
      )}

      {/* Location */}
      {areas.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1">
          <PinIcon />
          <p className="text-[12px] text-gray-600">
            {areas.join(" / ")}
          </p>
        </div>
      )}

      {/* Trades */}
      {occupationNames.length > 0 && (
        <div className="mt-1 flex items-center gap-1">
          <WrenchIcon />
          <p className="text-[12px] text-gray-600">
            {occupationNames.join(" / ")}
          </p>
        </div>
      )}

      {/* Workforce placeholder */}
      <div className="mt-1 flex items-center gap-1">
        <PersonIcon />
        <p className="text-[12px] text-gray-600">稼働可能人員目安</p>
      </div>

      {/* Week calendar */}
      <WeekCalendar contractor={c} />
    </Link>
  );
}

/* ─── Main Page ─── */

export default function SearchPage() {
  const { isContractor } = useMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [keyword, setKeyword] = useState("");
  const [selectedMajorId, setSelectedMajorId] = useState<string | null>(null);
  const [selectedPrefecture, setSelectedPrefecture] = useState<string | null>(
    null
  );
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [majors, setMajors] = useState<MajorItem[]>([]);
  const [jobPins, setJobPins] = useState<JobPin[]>([]);
  const [contractorPins, setContractorPins] = useState<ContractorPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // 初期データ取得
  useEffect(() => {
    if (isContractor) {
      Promise.all([
        searchContractors(),
        getOccupationMasters(),
        searchJobsWithLocation(),
      ])
        .then(([contractorData, majorData, pinData]) => {
          setContractors(contractorData);
          setMajors(majorData);
          setJobPins(pinData);
        })
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        searchContractors(),
        getOccupationMasters(),
        searchContractorsWithLocation(),
      ])
        .then(([contractorData, majorData, pinData]) => {
          setContractors(contractorData);
          setMajors(majorData);
          setContractorPins(pinData);
        })
        .finally(() => setLoading(false));
    }
  }, [isContractor]);

  // フィルター適用
  const applyFilters = useCallback(
    async (opts?: {
      kw?: string;
      majorId?: string | null;
      prefecture?: string | null;
    }) => {
      const kw = opts?.kw ?? keyword;
      const majorId =
        opts?.majorId !== undefined ? opts.majorId : selectedMajorId;
      const pref =
        opts?.prefecture !== undefined ? opts.prefecture : selectedPrefecture;

      setSearching(true);
      try {
        if (viewMode === "map") {
          if (isContractor) {
            const pins = await searchJobsWithLocation({
              keyword: kw || undefined,
              prefecture: pref || undefined,
            });
            setJobPins(pins);
          } else {
            const pins = await searchContractorsWithLocation({
              keyword: kw || undefined,
              prefecture: pref || undefined,
            });
            setContractorPins(pins);
          }
        } else {
          const results = await searchContractors({
            keyword: kw || undefined,
            occupationMajorItemId: majorId || undefined,
            prefecture: pref || undefined,
          });
          setContractors(results);
        }
      } finally {
        setSearching(false);
      }
    },
    [keyword, selectedMajorId, selectedPrefecture, viewMode, isContractor]
  );

  function handleMajorSelect(id: string | null) {
    setSelectedMajorId(id);
    applyFilters({ majorId: id });
  }

  function handlePrefectureSelect(pref: string | null) {
    setSelectedPrefecture(pref);
    applyFilters({ prefecture: pref });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilters({ kw: keyword });
    }
  }

  async function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setSearching(true);
    try {
      if (mode === "map") {
        if (isContractor) {
          const pins = await searchJobsWithLocation({
            keyword: keyword || undefined,
            prefecture: selectedPrefecture || undefined,
          });
          setJobPins(pins);
        } else {
          const pins = await searchContractorsWithLocation({
            keyword: keyword || undefined,
            prefecture: selectedPrefecture || undefined,
          });
          setContractorPins(pins);
        }
      } else {
        const results = await searchContractors({
          keyword: keyword || undefined,
          occupationMajorItemId: selectedMajorId || undefined,
          prefecture: selectedPrefecture || undefined,
        });
        setContractors(results);
      }
    } finally {
      setSearching(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <MenuIcon />
          </button>

          <div className="flex flex-col items-center">
            <h1 className="text-[17px] font-bold text-gray-900">探す</h1>
            <div className="mt-0.5 h-[3px] w-8 rounded-full bg-orange-400" />
          </div>

          <button className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100">
            <BellOffIcon />
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-3 pb-8">
        {/* キーワード検索 */}
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
          >
            <circle
              cx="8"
              cy="8"
              r="5.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M12.5 12.5L16 16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={viewMode === "list" ? "会社名で検索" : (isContractor ? "案件名で検索" : "会社名で検索")}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* リスト / マップ 切り替え */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
          <button
            onClick={() => handleViewModeChange("list")}
            className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-colors ${
              viewMode === "list"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            リスト
          </button>
          <button
            onClick={() => handleViewModeChange("map")}
            className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-colors ${
              viewMode === "map"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            マップ
          </button>
        </div>

        {/* リストモード専用フィルター */}
        {viewMode === "list" && (
          <>
            {/* 職種カテゴリ — 横スクロールチップ */}
            <div className="-mx-4 overflow-x-auto px-4">
              <div className="flex gap-2 pb-1">
                <button
                  onClick={() => handleMajorSelect(null)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                    selectedMajorId === null
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  全て
                </button>
                {majors.map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      handleMajorSelect(m.id === selectedMajorId ? null : m.id)
                    }
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                      selectedMajorId === m.id
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* エリア選択 */}
            <div className="flex items-center gap-2">
              <select
                value={selectedPrefecture ?? ""}
                onChange={(e) =>
                  handlePrefectureSelect(e.target.value || null)
                }
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">全エリア</option>
                {PREFECTURES.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* マップモード専用フィルター */}
        {viewMode === "map" && (
          <div className="flex items-center gap-2">
            <select
              value={selectedPrefecture ?? ""}
              onChange={(e) => handlePrefectureSelect(e.target.value || null)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全エリア</option>
              {PREFECTURES.map((pref) => (
                <option key={pref} value={pref}>
                  {pref}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* マップビュー */}
        {viewMode === "map" && (
          <div className="relative h-[60vh] min-h-[400px] rounded-2xl overflow-hidden">
            {searching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
              </div>
            )}
            {isContractor ? (
              <SearchMap
                jobs={jobPins}
                onSelectJob={(id) => { window.location.href = `/jobs/${id}`; }}
              />
            ) : (
              <SearchMap
                contractors={contractorPins}
                onSelectContractor={(id) => { window.location.href = `/search/${id}`; }}
              />
            )}
          </div>
        )}

        {/* リストビュー */}
        {viewMode === "list" && (
          <>
            {/* 件数 */}
            <p className="text-[12px] text-gray-500">
              {contractors.length}件の受注者
            </p>

            {searching ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
              </div>
            ) : contractors.length === 0 ? (
              <div className="flex flex-col items-center gap-3 pt-12">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle
                    cx="22"
                    cy="22"
                    r="14"
                    stroke="#D1D5DB"
                    strokeWidth="2"
                  />
                  <path
                    d="M32 32L42 42"
                    stroke="#D1D5DB"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <p className="text-[14px] text-gray-400">
                  該当する受注者が見つかりません
                </p>
                <p className="text-[12px] text-gray-400">
                  条件を変更して再度お試しください
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {contractors.map((c) => (
                  <ContractorCard key={c.id} c={c} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
