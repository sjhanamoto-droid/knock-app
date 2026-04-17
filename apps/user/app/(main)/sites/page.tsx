"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getSites,
  getContractorSites,
  type SiteSortField,
  type SiteSortOrder,
} from "@/lib/actions/sites";
import { useMode } from "@/lib/hooks/use-mode";
import {
  factoryFloorStatusLabels,
  factoryFloorStatusColors,
} from "@knock/utils";
import { SideMenu } from "@/components/side-menu";

const ORDERER_STATUS_TABS = [
  { value: "", label: "すべて" },
  { value: "NOT_ORDERED", label: "未発注" },
  { value: "ORDERED", label: "発注済" },
  { value: "ORDER_REQUESTED", label: "発注依頼" },
  { value: "CONFIRMED", label: "確定" },
  { value: "IN_PROGRESS", label: "作業中" },
  { value: "INSPECTION", label: "検収中" },
  { value: "COMPLETED", label: "完了" },
];

const CONTRACTOR_STATUS_TABS = [
  { value: "", label: "すべて" },
  { value: "CONFIRMED", label: "確定" },
  { value: "IN_PROGRESS", label: "作業中" },
  { value: "INSPECTION", label: "検収中" },
  { value: "COMPLETED", label: "完了" },
];

type Site = Awaited<ReturnType<typeof getSites>>[number];

/* ──────────── Icons ──────────── */

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

function BellIcon() {
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
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-3 top-1/2 -translate-y-1/2"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.4" />
      <path
        d="M11 11L14 14"
        stroke="#9CA3AF"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
      <path
        d="M6 1C4.343 1 3 2.343 3 4C3 6.5 6 11 6 11C6 11 9 6.5 9 4C9 2.343 7.657 1 6 1Z"
        stroke="#9CA3AF"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="4" r="1.2" stroke="#9CA3AF" strokeWidth="1.1" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
      <rect x="1" y="2.5" width="10" height="8.5" rx="1.5" stroke="#9CA3AF" strokeWidth="1.1" />
      <path d="M4 1V3M8 1V3" stroke="#9CA3AF" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M1 5H11" stroke="#9CA3AF" strokeWidth="1.1" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
      <rect x="2" y="2" width="8" height="9" rx="1" stroke="#9CA3AF" strokeWidth="1.1" />
      <path d="M4 5H5M7 5H8M4 7H5M7 7H8M4 9H5M7 9H8" stroke="#9CA3AF" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M5 3L9 7L5 11"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ──────────── Main Page ──────────── */

export default function SitesPage() {
  const { isOrderer, accentColor } = useMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SiteSortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SiteSortOrder>("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const statusTabs = isOrderer ? ORDERER_STATUS_TABS : CONTRACTOR_STATUS_TABS;

  const SORT_OPTIONS: { field: SiteSortField; order: SiteSortOrder; label: string }[] = [
    { field: "createdAt", order: "desc", label: "登録日（新しい順）" },
    { field: "createdAt", order: "asc", label: "登録日（古い順）" },
    { field: "startDayRequest", order: "desc", label: "工期開始日（新しい順）" },
    { field: "startDayRequest", order: "asc", label: "工期開始日（古い順）" },
    { field: "endDayRequest", order: "desc", label: "工期終了日（新しい順）" },
    { field: "endDayRequest", order: "asc", label: "工期終了日（古い順）" },
  ];

  // 検索デバウンス
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    try {
      const fetcher = isOrderer ? getSites : getContractorSites;
      const data = await fetcher(
        activeTab || undefined,
        debouncedSearch || undefined,
        sortBy,
        sortOrder
      );
      setSites(data as Site[]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, isOrderer, sortBy, sortOrder]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  function formatDate(d: string | Date | null | undefined): string {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}(${days[date.getDay()]})`;
  }

  function formatAmount(n: number | bigint | null | undefined): string {
    if (n == null) return "";
    return `${Number(n).toLocaleString("ja-JP")}円`;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
              現場
            </h1>
            <div
              className="mt-0.5 h-[3px] w-8 rounded-full"
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

        {/* Search bar */}
        <div className="px-4 pb-2">
          <div className="relative">
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="現場名検索"
              className="w-full rounded-full bg-[#F0F0F0] py-2.5 pl-9 pr-9 text-[13px] text-knock-text placeholder:text-gray-400 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 3L11 11M11 3L3 11"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Sort + Status Tabs */}
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors active:bg-gray-50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <path d="M2 4H12M4 7H10M6 10H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              {SORT_OPTIONS.find((o) => o.field === sortBy && o.order === sortOrder)?.label ?? "並び替え"}
            </button>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-50"
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  {SORT_OPTIONS.map((opt) => {
                    const isActive = sortBy === opt.field && sortOrder === opt.order;
                    return (
                      <button
                        key={`${opt.field}-${opt.order}`}
                        onClick={() => {
                          setSortBy(opt.field);
                          setSortOrder(opt.order);
                          setShowSortMenu(false);
                        }}
                        className={`flex w-full items-center px-4 py-2.5 text-left text-[13px] transition-colors ${
                          isActive
                            ? "bg-gray-50 font-bold text-knock-text"
                            : "text-gray-600 active:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="ml-auto shrink-0">
                            <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                activeTab === tab.value
                  ? "bg-knock-text text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* 発注者: 新規作成FAB */}
      {isOrderer && (
        <Link
          href="/sites/new"
          className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all active:scale-95"
          style={{ backgroundColor: accentColor }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </Link>
      )}

      {/* Site List */}
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : sites.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white py-12 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect
                x="6"
                y="12"
                width="28"
                height="20"
                rx="3"
                stroke="#D1D5DB"
                strokeWidth="1.8"
              />
              <path
                d="M14 12V8C14 6.343 15.343 5 17 5H23C24.657 5 26 6.343 26 8V12"
                stroke="#D1D5DB"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[13px] text-knock-text-muted">
              {debouncedSearch
                ? "検索結果がありません"
                : "現場がありません"}
            </span>
          </div>
        ) : (
          sites.map((site) => {
            const companyName =
              (site as { workCompany?: { name: string } | null }).workCompany?.name ??
              (site as { company?: { name: string } | null }).company?.name;

            return (
              <Link
                key={site.id}
                href={`/sites/${site.id}`}
                className="overflow-hidden rounded-xl bg-white shadow-[0_1px_6px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98]"
                style={{ borderLeft: `4px solid ${accentColor}` }}
              >
                <div className="px-4 py-3">
                  {/* Top row: status badge + chevron button */}
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          factoryFloorStatusColors[site.status] ??
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {factoryFloorStatusLabels[site.status] ?? site.status}
                      </span>
                    </div>
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: accentColor }}
                    >
                      <ChevronRightIcon />
                    </div>
                  </div>

                  {/* Site name */}
                  <p className="mb-2 text-[14px] font-bold text-knock-text leading-snug">
                    {site.name ?? "名称未設定"}
                  </p>

                  {/* Details */}
                  <div className="flex flex-col gap-1">
                    {site.address && (
                      <div className="flex items-center gap-1.5">
                        <PinIcon />
                        <span className="truncate text-[11px] text-gray-500">
                          {site.address}
                        </span>
                      </div>
                    )}

                    {(site.startDayRequest || site.endDayRequest) && (
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon />
                        <span className="text-[11px] text-gray-500">
                          {formatDate(site.startDayRequest)}
                          {site.startDayRequest && site.endDayRequest && " ~ "}
                          {formatDate(site.endDayRequest)}
                        </span>
                      </div>
                    )}

                    {companyName && (
                      <div className="flex items-center gap-1.5">
                        <BuildingIcon />
                        <span className="truncate text-[11px] text-gray-500">
                          {companyName}
                        </span>
                      </div>
                    )}

                    {site.totalAmount != null && Number(site.totalAmount) > 0 && (
                      <div className="mt-0.5 flex items-center justify-end">
                        <span className="text-[12px] font-semibold text-knock-text">
                          {formatAmount(
                            Number(site.totalAmount) +
                              Math.floor(Number(site.totalAmount) * 0.1)
                          )}
                          <span className="ml-0.5 text-[10px] font-normal text-gray-400">
                            （税込）
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
