"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCompanies } from "@/lib/actions/customers";
import { companyTypeLabels, formatDate } from "@knock/utils";

type CompanyList = Awaited<ReturnType<typeof getCompanies>>;

const selectCls =
  "rounded-xl bg-[#F0F0F0] border-none px-4 py-2.5 text-[13px] text-gray-700 focus:ring-2 focus:ring-knock-blue/20 focus:outline-none appearance-none";

export default function CustomersPage() {
  const [data, setData] = useState<CompanyList | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    getCompanies({
      search: search || undefined,
      type: typeFilter || undefined,
      isActive: activeFilter || undefined,
      page,
      sortBy,
      sortOrder,
    })
      .then(setData)
      .catch((err) => {
        console.error("[Customers] Failed to fetch companies:", err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [search, typeFilter, activeFilter, page, sortBy, sortOrder]);

  const hasFilters = typeFilter || activeFilter;

  function clearFilters() {
    setTypeFilter("");
    setActiveFilter("");
    setPage(1);
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder(column === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  }

  function SortIcon({ column }: { column: string }) {
    if (sortBy !== column) return null;
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className={`ml-1 inline-block transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`}
      >
        <path
          d="M3 5L6 8L9 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-gray-900">顧客管理</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            {data ? `${data.total}件の企業` : ""}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-knock-amber"
        >
          + 企業を追加
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="企業名・メールで検索..."
          className="w-full max-w-xs rounded-xl bg-[#F0F0F0] border-none px-4 py-2.5 text-[13px] placeholder:text-gray-400 focus:ring-2 focus:ring-knock-blue/20 focus:outline-none"
        />

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className={selectCls}
        >
          <option value="">種別: すべて</option>
          <option value="ORDERER">発注者</option>
          <option value="CONTRACTOR">受注者</option>
          <option value="BOTH">発注者・受注者</option>
        </select>

        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(1);
          }}
          className={selectCls}
        >
          <option value="">状態: すべて</option>
          <option value="true">有効</option>
          <option value="false">無効</option>
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-[12px] font-medium text-gray-500 hover:text-gray-700"
          >
            フィルターをクリア
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border-none bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                企業名
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                種別
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                メール
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                ユーザー数
              </th>
              <th
                className="cursor-pointer select-none px-4 py-3 text-[12px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
                onClick={() => toggleSort("createdAt")}
              >
                登録日
                <SortIcon column="createdAt" />
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                状態
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-[13px] text-gray-400"
                >
                  読み込み中...
                </td>
              </tr>
            ) : !data || data.companies.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-[13px] text-gray-400"
                >
                  企業が見つかりません
                </td>
              </tr>
            ) : (
              data.companies.map((company) => (
                <tr
                  key={company.id}
                  className="cursor-pointer border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${company.id}`}
                      className="text-[13px] font-medium text-gray-900 hover:text-knock-blue"
                    >
                      {company.name || "(未設定)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${company.type === "ORDERER" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}
                    >
                      {companyTypeLabels[company.type] ?? company.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">
                    {company.email || "-"}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">
                    {company._count.users}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">
                    {formatDate(new Date(company.createdAt))}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[12px] font-bold ${company.isActive ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {company.isActive ? "有効" : "無効"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <span className="text-[12px] text-gray-500">
              {page} / {data.totalPages} ページ
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 disabled:opacity-40"
              >
                前へ
              </button>
              <button
                onClick={() =>
                  setPage((p) => Math.min(data.totalPages, p + 1))
                }
                disabled={page >= data.totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
