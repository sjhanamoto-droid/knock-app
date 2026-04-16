"use client";

import Link from "next/link";

interface SiteCardProps {
  id: string;
  name: string | null;
  address?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  companyName?: string | null;
  personName?: string | null;
  status: string;
  statusLabel: string;
  accentColor?: string;
}

const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
  NOT_ORDERED: { bg: "bg-red-50", text: "text-red-600", border: "border-l-red-500" },
  ORDER_REQUESTED: { bg: "bg-orange-50", text: "text-orange-600", border: "border-l-orange-500" },
  ORDERED: { bg: "bg-blue-50", text: "text-blue-600", border: "border-l-blue-500" },
  CONFIRMED: { bg: "bg-blue-50", text: "text-blue-600", border: "border-l-blue-500" },
  IN_PROGRESS: { bg: "bg-orange-50", text: "text-orange-600", border: "border-l-orange-500" },
  INSPECTION: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-l-emerald-500" },
  COMPLETED: { bg: "bg-gray-100", text: "text-gray-600", border: "border-l-gray-400" },
};

const statusIcons: Record<string, React.ReactNode> = {
  NOT_ORDERED: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 4V7.5M7 9.5V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  IN_PROGRESS: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 12L7 2L12 12H2Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 6V8.5M7 10V10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  CONFIRMED: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 7L6.5 9L9.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function formatDateJP(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dow = days[date.getDay()];
  return `${y}/${m}/${day}(${dow})`;
}

export function SiteCard({
  id,
  name,
  address,
  startDate,
  endDate,
  companyName,
  personName,
  status,
  statusLabel,
  accentColor = "#3B82F6",
}: SiteCardProps) {
  const style = statusStyles[status] ?? statusStyles.CONFIRMED;

  return (
    <Link
      href={`/sites/${id}`}
      className={`block overflow-hidden rounded-xl bg-white border-l-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98]`}
      style={{ borderLeftColor: accentColor }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${style.bg} ${style.text}`}>
          {statusIcons[status] ?? statusIcons.CONFIRMED}
          {statusLabel}
        </span>
        {personName && (
          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
            {personName}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex items-center px-4 pb-3 pt-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-[15px] font-bold text-knock-text truncate">
            {name ?? "名称未設定"}
          </h3>

          {address && (
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <path d="M6 1C4.067 1 2.5 2.567 2.5 4.5C2.5 7.25 6 11 6 11C6 11 9.5 7.25 9.5 4.5C9.5 2.567 7.933 1 6 1Z" stroke="#9CA3AF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="6" cy="4.5" r="1.2" stroke="#9CA3AF" strokeWidth="0.8" />
              </svg>
              <span className="truncate">{address}</span>
            </div>
          )}

          {(startDate || endDate) && (
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <rect x="1.5" y="2" width="9" height="8.5" rx="1" stroke="#9CA3AF" strokeWidth="0.9" />
                <path d="M1.5 4.5H10.5" stroke="#9CA3AF" strokeWidth="0.9" />
                <path d="M4 1V3M8 1V3" stroke="#9CA3AF" strokeWidth="0.9" strokeLinecap="round" />
              </svg>
              <span>
                {formatDateJP(startDate)} ~ {formatDateJP(endDate)}
              </span>
            </div>
          )}

          {companyName && (
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <rect x="1.5" y="3" width="9" height="7.5" rx="1" stroke="#9CA3AF" strokeWidth="0.9" />
                <path d="M4 3V1.5H8V3" stroke="#9CA3AF" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="truncate">{companyName}</span>
            </div>
          )}
        </div>

        {/* Chevron button */}
        <div
          className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: accentColor }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
