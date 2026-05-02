"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMode } from "@/lib/hooks/use-mode";
import { getBillingList } from "@/lib/actions/invoices";
import { useToast } from "@knock/ui";

type InvoiceItem = Awaited<ReturnType<typeof getBillingList>>[number];

const statusLabels: Record<string, string> = {
  DRAFT: "確認待ち",
  ISSUED: "確定済み",
  CONFIRMED: "支払済み",
  VOID: "無効",
};

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "#FEF3C7", text: "#92400E" },
  ISSUED: { bg: "#DBEAFE", text: "#1E40AF" },
  CONFIRMED: { bg: "#D1FAE5", text: "#065F46" },
  VOID: { bg: "#F3F4F6", text: "#6B7280" },
};

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
      <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const { accentColor } = useMode();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 月選択: 現在月
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const yearMonth = `${selectedYear}${String(selectedMonth).padStart(2, "0")}`;

  useEffect(() => {
    setLoading(true);
    getBillingList(yearMonth)
      .then(setInvoices)
      .catch(() => toast("請求書の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [yearMonth]);

  function prevMonth() {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-32">
      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white px-4 py-3 text-center shadow-sm">
        <button
          onClick={() => router.back()}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-1"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="#1A2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-[16px] font-bold text-[#1A2340]">請求書管理</h1>
        <div className="flex justify-center mt-1">
          <WavyUnderline color={accentColor} />
        </div>
      </div>

      {/* 月選択 */}
      <div className="flex items-center justify-center gap-6 py-4">
        <button onClick={prevMonth} className="p-2 rounded-full active:bg-gray-200">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="#1A2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[16px] font-bold text-[#1A2340]">
          {selectedYear}年{selectedMonth}月
        </span>
        <button onClick={nextMonth} className="p-2 rounded-full active:bg-gray-200">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 4L14 10L8 16" stroke="#1A2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="space-y-3 px-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <p className="text-[14px] text-gray-400">この月の請求書はありません</p>
          </div>
        ) : (
          invoices.map((inv) => {
            const sc = statusColors[inv.status] ?? statusColors.VOID;
            return (
              <Link
                key={inv.id}
                href={`/billing/${inv.id}`}
                className="block rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.99]"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[14px] font-bold text-[#1A2340]">
                      {inv.isOrderer ? inv.workerCompany.name : inv.orderCompany.name}
                    </p>
                    <p className="text-[12px] text-knock-text-secondary mt-0.5">
                      {inv.isOrderer ? "受注者" : "発注者"} / {inv.documentNumber}
                    </p>
                  </div>
                  <span
                    className="rounded-lg px-2.5 py-1 text-[11px] font-bold"
                    style={{ backgroundColor: sc.bg, color: sc.text }}
                  >
                    {statusLabels[inv.status] ?? inv.status}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-[12px] text-knock-text-secondary">
                    {inv.dueDate && (
                      <span>支払期日: {new Date(inv.dueDate).toLocaleDateString("ja-JP")}</span>
                    )}
                  </div>
                  <p className="text-[18px] font-bold" style={{ color: accentColor }}>
                    ¥{inv.totalAmount.toLocaleString()}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
