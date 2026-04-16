"use client";

import { formatCurrency } from "@knock/utils";

interface SummaryData {
  count: number;
  amount: number;
  isOrderer: boolean;
}

export function MonthlySummary({
  summary,
  accentColor,
  isOrderer,
}: {
  summary: SummaryData;
  accentColor: string;
  isOrderer: boolean;
}) {
  const now = new Date();
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  const amountLabel = isOrderer ? "支出合計" : "売上合計";

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <h3 className="mb-3 text-[14px] font-bold text-knock-text">
        今月のサマリー
      </h3>
      <div className="flex items-center gap-4">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-knock-bg p-3">
          <span className="text-[11px] text-knock-text-secondary">取引件数</span>
          <span className="text-[20px] font-bold" style={{ color: accentColor }}>
            {summary.count}
            <span className="text-[13px] font-medium text-knock-text-secondary">件</span>
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 rounded-xl bg-knock-bg p-3">
          <span className="text-[11px] text-knock-text-secondary">{amountLabel}</span>
          <span className="text-[20px] font-bold" style={{ color: accentColor }}>
            {formatCurrency(summary.amount)}
          </span>
        </div>
      </div>
    </div>
  );
}
