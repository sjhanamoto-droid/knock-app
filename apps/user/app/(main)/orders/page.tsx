"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SideMenu } from "@/components/side-menu";
import { useMode } from "@/lib/hooks/use-mode";
import { getOrders } from "@/lib/actions/orders";
import { orderStatusLabels, orderStatusColors, formatDate } from "@knock/utils";

type Order = Awaited<ReturnType<typeof getOrders>>[number];

const STATUS_TABS = [
  { value: "", label: "すべて" },
  { value: "PENDING", label: "承認待ち" },
  { value: "APPROVED", label: "承認済" },
  { value: "CONFIRMED", label: "確定" },
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

/* ──────────── Left-border color by status ──────────── */

const STATUS_BORDER: Record<string, string> = {
  PENDING:   "border-l-amber-400",
  APPROVED:  "border-l-blue-400",
  CONFIRMED: "border-l-emerald-400",
  REJECTED:  "border-l-red-400",
  CANCELLED: "border-l-gray-300",
};

/* ──────────── Page ──────────── */

export default function OrdersPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { accentColor } = useMode();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getOrders(activeTab || undefined)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [activeTab]);

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
              発注一覧
            </h1>
            <WavyUnderline color={accentColor} />
          </div>

          <Link
            href="/notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <BellIcon />
          </Link>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
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

      {/* ─── Content ─── */}
      <div className="flex flex-col gap-2.5 px-4 pt-3 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white py-12 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="8" y="5" width="24" height="30" rx="3" stroke="#D1D5DB" strokeWidth="1.8" />
              <path d="M14 13H26M14 19H26M14 25H20" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[13px] text-knock-text-muted">発注がありません</span>
          </div>
        ) : (
          orders.map((order) => {
            const isOrderer = order.factoryFloor.companyId === order.viewerCompanyId;
            const counterpart = isOrderer
              ? order.factoryFloor.workCompany
              : order.factoryFloor.company;

            const borderClass = order.status
              ? (STATUS_BORDER[order.status] ?? "border-l-gray-200")
              : "border-l-gray-200";

            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className={`flex items-center gap-3.5 rounded-xl border-l-4 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98] ${borderClass}`}
              >
                {/* Text content */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[14px] font-semibold text-knock-text">
                    {order.factoryFloor.name ?? "名称未設定"}
                  </span>
                  <span className="text-[12px] text-knock-text-secondary">
                    {counterpart?.name ?? ""} ・ {formatDate(new Date(order.createdAt))}
                  </span>
                  {order.status && (
                    <span
                      className={`mt-0.5 w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        orderStatusColors[order.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {orderStatusLabels[order.status] ?? order.status}
                    </span>
                  )}
                </div>

                {/* Chevron circle button */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-knock-blue">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3L9 7L5 11" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
