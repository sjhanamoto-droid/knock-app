"use client";

import { useState, useEffect } from "react";
import { getDashboardStats } from "@/lib/actions/settings";

type Stats = Awaited<ReturnType<typeof getDashboardStats>>;

const statCards = [
  { key: "companyCount" as const, label: "登録企業数", icon: "company", color: "bg-blue-50 text-blue-600" },
  { key: "activeFloorCount" as const, label: "アクティブ現場", icon: "site", color: "bg-emerald-50 text-emerald-600" },
  { key: "userCount" as const, label: "登録ユーザー数", icon: "user", color: "bg-purple-50 text-purple-600" },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-[24px] font-bold text-gray-900">ダッシュボード</h1>
      <p className="mt-1 text-[14px] text-gray-500">Knock管理画面の概要</p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-gray-500">{card.label}</span>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.color}`}>
                {card.icon === "company" && (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6 4V2.5C6 1.67 6.67 1 7.5 1H10.5C11.33 1 12 1.67 12 2.5V4" stroke="currentColor" strokeWidth="1.4"/></svg>
                )}
                {card.icon === "site" && (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="6" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6 6V4C6 2.895 6.895 2 8 2H10C11.105 2 12 2.895 12 4V6" stroke="currentColor" strokeWidth="1.4"/></svg>
                )}
                {card.icon === "user" && (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M3 16C3 13.239 5.686 11 9 11C12.314 11 15 13.239 15 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                )}
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <div className="h-10 w-20 animate-pulse rounded-lg bg-gray-100" />
              ) : (
                <span className="text-[32px] font-bold text-gray-900">
                  {stats?.[card.key] ?? 0}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
