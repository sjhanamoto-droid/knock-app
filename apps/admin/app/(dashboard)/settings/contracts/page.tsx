"use client";

import { useState, useEffect } from "react";
import { getCompanyContracts } from "@/lib/actions/settings";
import { contractStatusLabels, paymentStatusLabels, companyTypeLabels, formatCurrency, formatDate } from "@knock/utils";

type ContractList = Awaited<ReturnType<typeof getCompanyContracts>>;

export default function ContractsPage() {
  const [data, setData] = useState<ContractList | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCompanyContracts({ page })
      .then(setData)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <button
        onClick={() => history.back()}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        設定に戻る
      </button>
      <h1 className="mt-1 text-[24px] font-bold text-gray-900">企業契約</h1>
      <p className="mt-1 text-[14px] text-gray-500">{data ? `${data.total}件` : ""}</p>

      <div className="mt-4 overflow-hidden rounded-2xl border-none bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">企業名</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">種別</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">プラン名</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">契約状態</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">支払状態</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">金額</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">開始日</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-gray-400">読み込み中...</td></tr>
            ) : !data || data.contracts.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-gray-400">契約がありません</td></tr>
            ) : (
              data.contracts.map((contract) => (
                <tr key={contract.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{contract.company.name ?? "(未設定)"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${contract.company.type === "ORDERER" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {companyTypeLabels[contract.company.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">{contract.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                      {contractStatusLabels[contract.contractStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[12px] font-bold ${contract.paymentStatus === "PAID" ? "text-emerald-600" : "text-amber-600"}`}>
                      {paymentStatusLabels[contract.paymentStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">{contract.totalAmount ? formatCurrency(contract.totalAmount) : "-"}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">{contract.contractStartDate ? formatDate(new Date(contract.contractStartDate)) : "-"}</td>
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
