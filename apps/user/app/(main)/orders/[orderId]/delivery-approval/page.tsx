"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getOrderDetail, approveDelivery } from "@/lib/actions/orders";
import { formatCurrency } from "@knock/utils";
import { ConfirmDialog, AlertDialog } from "@knock/ui";

type OrderDetail = Awaited<ReturnType<typeof getOrderDetail>>;

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
      <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function DeliveryApprovalPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { accentColor } = useMode();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    getOrderDetail(orderId)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleApprove() {
    setSubmitting(true);
    try {
      await approveDelivery(orderId);
      setSuccessMessage("納品金額を承認しました");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-4 text-center text-knock-text-muted">取引が見つかりません</div>;
  }

  const floor = order.factoryFloor;
  const contractAmount = Number(floor.totalAmount ?? 0);
  const contractTax = Math.floor(contractAmount * 0.1);
  const actualAmount = Number(order.actualAmount ?? floor.totalAmount ?? 0);
  const additionalWork = order.completionReport?.hasAdditionalWork
    ? Number(order.completionReport.additionalWorkAmount ?? 0)
    : 0;

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="relative flex h-14 items-center justify-center px-4">
          <button
            onClick={() => router.back()}
            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[16px] font-bold text-knock-text">納品金額確認</span>
            <WavyUnderline color={accentColor} />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        <div className="rounded-xl bg-blue-50 p-3 text-center">
          <span className="text-[14px] font-bold text-knock-blue">
            納品金額をご確認ください
          </span>
        </div>

        <p className="text-[13px] text-knock-text-secondary">
          {floor.name ?? ""} / {floor.company?.name ?? ""} より
        </p>

        <div
          className="rounded-2xl border-l-4 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
          style={{ borderLeftColor: accentColor }}
        >
          <div className="flex flex-col gap-2 text-[14px]">
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between">
                <span>契約金額（税抜）</span>
                <span>{formatCurrency(contractAmount)}</span>
              </div>
              <div className="flex justify-between text-knock-text-secondary">
                <span>消費税（10%）</span>
                <span>{formatCurrency(contractTax)}</span>
              </div>
            </div>
            {additionalWork > 0 && (
              <div className="flex justify-between">
                <span>＋追加工事</span>
                <span>{formatCurrency(additionalWork)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t pt-2">
              <span className="font-bold">納品金額</span>
              <span className="text-[16px] font-bold" style={{ color: accentColor }}>
                {formatCurrency(actualAmount)}
              </span>
            </div>
            <span className="text-right text-[11px] text-knock-text-secondary">（税込）</span>
          </div>
        </div>

        <p className="text-center text-[13px] text-knock-text-secondary">
          内訳を確認して問題なければ承認してください
        </p>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={submitting}
          className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          {submitting ? "処理中..." : "内容を承認する"}
        </button>
        <p className="text-center text-[11px] text-knock-text-secondary">
          → 承認すると納品書が自動生成されます
        </p>

        <button
          onClick={() => router.push(`/chat?siteId=${floor.id}`)}
          className="w-full rounded-xl border-2 py-3.5 text-[15px] font-bold transition-all active:scale-[0.97]"
          style={{ borderColor: accentColor, color: accentColor }}
        >
          金額について相談する
        </button>
        <p className="text-center text-[11px] text-knock-text-secondary">
          → チャットで発注者に連絡
        </p>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleApprove}
        title="納品金額の承認"
        message="納品金額を承認しますか？承認すると納品書が自動生成されます。"
        confirmLabel={submitting ? "処理中..." : "はい"}
        cancelLabel="いいえ"
        variant="primary"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => router.replace(`/sites/${order?.factoryFloor?.id}`)}
        title="完了"
        message={successMessage}
      />
    </div>
  );
}
