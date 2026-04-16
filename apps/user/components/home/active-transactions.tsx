"use client";

import Link from "next/link";
import { factoryFloorStatusLabels, factoryFloorStatusColors } from "@knock/utils";

interface Transaction {
  id: string;
  orderStatus: string | null;
  siteId: string;
  siteName: string;
  siteStatus: string;
  address: string | null;
  startDayRequest: Date | null;
  endDayRequest: Date | null;
  ordererName: string;
  contractorName: string;
  siteInfoRoomId: string | null;
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
  isOrderer,
  accentColor,
}: {
  tx: Transaction;
  isOrderer: boolean;
  accentColor: string;
}) {
  const statusLabel = factoryFloorStatusLabels[tx.siteStatus] ?? tx.siteStatus;
  const personName = isOrderer ? tx.contractorName : tx.ordererName;
  const dateStr =
    tx.startDayRequest || tx.endDayRequest
      ? `${formatDateShort(tx.startDayRequest)}${tx.startDayRequest && tx.endDayRequest ? " 〜 " : ""}${formatDateShort(tx.endDayRequest)}`
      : null;

  return (
    <div className="flex items-stretch gap-0 overflow-hidden rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      {/* Left border accent */}
      <div className="w-1 shrink-0 rounded-l-2xl" style={{ backgroundColor: accentColor }} />

      {/* Card body */}
      <div className="flex flex-1 items-center gap-2 px-3 py-3">
        <Link
          href={`/sites/${tx.siteId}`}
          className="flex flex-1 items-center gap-3 min-w-0 transition-all active:opacity-70"
        >
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            {/* Status badge + person name row */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  factoryFloorStatusColors[tx.siteStatus] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {statusLabel}
              </span>
              {personName && (
                <span className="shrink-0 text-[11px] text-knock-text-secondary">
                  {personName}
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
            {(isOrderer ? tx.contractorName : tx.ordererName) && (
              <div className="flex items-center gap-1">
                <CompanyIcon />
                <span className="truncate text-[11px] text-knock-text-secondary">
                  {isOrderer ? tx.contractorName : tx.ordererName}
                </span>
              </div>
            )}
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
  const count = transactions.length;
  const totalCount = allTransactions.length;

  return (
    <div className="flex flex-col gap-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
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
      </div>

      {/* Cards */}
      {count === 0 ? (
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-center text-[13px] text-knock-text-muted">
            {totalCount === 0
              ? `進行中の${isOrderer ? "現場" : "取引"}はありません`
              : "この日の現場はありません"}
          </p>
        </div>
      ) : (
        transactions.map((tx) => (
          <SiteCard
            key={tx.id}
            tx={tx}
            isOrderer={isOrderer}
            accentColor={accentColor}
          />
        ))
      )}
    </div>
  );
}
