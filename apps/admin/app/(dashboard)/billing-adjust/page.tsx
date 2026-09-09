"use client";

import { useState, useEffect, useCallback } from "react";
import { getClosedOrdersForAdjust, updateOrderCompletedDay } from "@/lib/actions/billing-adjust";

type Result = Awaited<ReturnType<typeof getClosedOrdersForAdjust>>;
type Row = Result["rows"][number];

// ISO(UTC 00:00 の日付) → "YYYY-MM-DD"。保存形式が日付のみなので UTC 成分で取り出す
function toInputDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function fmtMonth(ym: string | null): string {
  if (!ym) return "-";
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function BillingAdjustPage() {
  const [data, setData] = useState<Result | null>(null);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(currentMonthValue()); // "YYYY-MM"（空=全期間）
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // 行ごとの編集状態: 入力中の日付 / 確定待ち / 送信中 / 結果メッセージ
  const [dates, setDates] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getClosedOrdersForAdjust({
      search: search || undefined,
      yearMonth: month ? month.replace("-", "") : undefined,
      page,
    })
      .then((res) => {
        setData(res);
        setDates(Object.fromEntries(res.rows.map((r) => [r.id, toInputDate(r.completedDay)])));
      })
      .finally(() => setLoading(false));
  }, [search, month, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(row: Row) {
    const date = dates[row.id];
    if (!date) return;
    setSaving(row.id);
    setMessage(null);
    try {
      await updateOrderCompletedDay(row.id, date);
      setConfirming(null);
      setMessage({ id: row.id, text: `完了日を ${date} に変更しました`, ok: true });
      load();
    } catch (e) {
      setMessage({ id: row.id, text: e instanceof Error ? e.message : "変更に失敗しました", ok: false });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <h1 className="text-[24px] font-bold text-gray-900">請求月の調整</h1>
      <p className="mt-1 text-[14px] text-gray-500">
        受注者の施工報告で自動確定した「完了日」（請求月の基準日）を運営側で変更します。
        請求書に含まれている発注書は変更できません（先に請求書を無効にしてください）。
      </p>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="発注者・受注者・現場名で検索..."
          className="w-full max-w-sm rounded-xl bg-[#F0F0F0] border-none px-4 py-2.5 text-[13px] placeholder:text-gray-400 focus:ring-2 focus:ring-knock-blue/20 focus:outline-none"
        />
        <input
          type="month"
          value={month}
          onChange={(e) => { setMonth(e.target.value); setPage(1); }}
          className="rounded-xl bg-[#F0F0F0] border-none px-4 py-2.5 text-[13px] text-gray-700 focus:ring-2 focus:ring-knock-blue/20 focus:outline-none"
        />
        {month && (
          <button
            onClick={() => { setMonth(""); setPage(1); }}
            className="rounded-xl px-3 py-2.5 text-[12px] font-medium text-gray-500 hover:bg-gray-100"
          >
            全期間
          </button>
        )}
        <span className="self-center text-[12px] text-gray-400">
          {data ? `${data.total}件（完了日のカレンダー月で絞り込み）` : ""}
        </span>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border-none bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50/80">
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">完了日</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">請求月</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">発注者 → 受注者</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">現場 / 工事</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">注文書</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400 text-right">税込</th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-gray-400">読み込み中...</td></tr>
            ) : !data || data.rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-gray-400">完了した発注書が見つかりません</td></tr>
            ) : (
              data.rows.map((row) => {
                const value = dates[row.id] ?? "";
                const changed = value !== toInputDate(row.completedDay);
                const isConfirming = confirming === row.id;
                const isSaving = saving === row.id;
                return (
                  <tr key={row.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 align-top">
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={value}
                        disabled={row.invoiced || isSaving}
                        onChange={(e) => {
                          setDates((prev) => ({ ...prev, [row.id]: e.target.value }));
                          setConfirming(null);
                        }}
                        className="rounded-lg bg-[#F0F0F0] border-none px-2.5 py-1.5 text-[13px] text-gray-900 disabled:opacity-50"
                      />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">
                      {fmtMonth(row.billingMonth)}
                      <div className="text-[11px] text-gray-400">
                        {row.closingDay == null ? "月末締め" : `${row.closingDay}日締め`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">
                      {row.ordererName}
                      <div className="text-gray-400">→ {row.workerName}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-900">
                      {row.parentSiteName && (
                        <div className="text-[12px] font-normal text-gray-400">{row.parentSiteName}</div>
                      )}
                      <div className="font-medium">{row.siteName}</div>
                      {row.siteCode && <div className="text-[11px] text-gray-400">工事番号 {row.siteCode}</div>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-600">{row.documentNumber || "-"}</td>
                    <td className="px-4 py-3 text-[13px] text-right text-gray-900">¥{row.totalAmount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {row.invoiced ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">請求済み（変更不可）</span>
                      ) : isConfirming ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSave(row)}
                            disabled={isSaving}
                            className="rounded-md bg-knock-orange px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                          >
                            {isSaving ? "変更中..." : `${value} に確定`}
                          </button>
                          <button
                            onClick={() => setConfirming(null)}
                            disabled={isSaving}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-600 disabled:opacity-40"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirming(row.id)}
                          disabled={!changed || !value}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-600 disabled:opacity-40"
                        >
                          変更
                        </button>
                      )}
                      {message?.id === row.id && (
                        <div className={`mt-1 text-[11px] ${message.ok ? "text-green-600" : "text-red-600"}`}>
                          {message.text}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
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
