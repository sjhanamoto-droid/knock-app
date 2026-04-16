"use client";

import { useState, useEffect } from "react";
import { getAllSites } from "@/lib/actions/sites";
import { factoryFloorStatusLabels, factoryFloorStatusColors, formatDate } from "@knock/utils";

type SiteList = Awaited<ReturnType<typeof getAllSites>>;

const STATUS_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "NOT_ORDERED", label: "未発注" },
  { value: "ORDERED", label: "発注済" },
  { value: "IN_PROGRESS", label: "作業中" },
  { value: "COMPLETED", label: "完了" },
];

export default function AdminSitesPage() {
  const [data, setData] = useState<SiteList | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAllSites({
      status: status || undefined,
      search: search || undefined,
      page,
    })
      .then(setData)
      .finally(() => setLoading(false));
  }, [status, search, page]);

  return (
    <div>
      <h1 className="text-[24px] font-bold text-gray-900">現場管理</h1>
      <p className="mt-1 text-[14px] text-gray-500">
        {data ? `${data.total}件の現場` : ""}
      </p>

      {/* Filters */}
      <div className="mt-4 flex gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="現場名・住所で検索..."
          className="w-full max-w-sm rounded-xl bg-[#F0F0F0] border-none px-4 py-2.5 text-[13px] placeholder:text-gray-400 focus:ring-2 focus:ring-knock-blue/20 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-xl bg-[#F0F0F0] border-none px-4 py-2.5 text-[13px] text-gray-700 focus:ring-2 focus:ring-knock-blue/20 focus:outline-none appearance-none"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border-none bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50/80">
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">現場名</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">発注企業</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">施工企業</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">ステータス</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">作成日</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-gray-400">読み込み中...</td></tr>
            ) : !data || data.sites.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-gray-400">現場が見つかりません</td></tr>
            ) : (
              data.sites.map((site) => (
                <tr key={site.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{site.name ?? "名称未設定"}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">{site.company.name ?? "(未設定)"}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">{site.workCompany?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${factoryFloorStatusColors[site.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {factoryFloorStatusLabels[site.status] ?? site.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">{formatDate(new Date(site.createdAt))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <span className="text-[12px] text-gray-500">{page} / {data.totalPages} ページ</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-600 disabled:opacity-40">前へ</button>
              <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-600 disabled:opacity-40">次へ</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
