"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getAdditionalOrderDetail,
  acceptAdditionalOrder,
  rejectAdditionalOrder,
  confirmAdditionalOrder,
} from "@/lib/actions/orders";
import { formatCurrency } from "@knock/utils";
import { ConfirmDialog, useToast } from "@knock/ui";

type OrderDetail = NonNullable<Awaited<ReturnType<typeof getAdditionalOrderDetail>>>;

export default function AdditionalReviewPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    getAdditionalOrderDetail(orderId)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleAccept() {
    setSubmitting(true);
    try {
      const result = await acceptAdditionalOrder(orderId);
      if (!result.success) {
        setShowAcceptDialog(false);
        toast(result.error ?? "エラーが発生しました");
        alert(result.error ?? "エラーが発生しました");
        setSubmitting(false);
        return;
      }
      setShowAcceptDialog(false);
      toast("追加工事を承諾しました");
      setTimeout(() => router.back(), 1000);
    } catch (e) {
      setShowAcceptDialog(false);
      const msg = e instanceof Error ? e.message : "エラーが発生しました";
      toast(msg);
      alert(msg);
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    try {
      const result = await rejectAdditionalOrder(orderId);
      if (!result.success) {
        setShowRejectDialog(false);
        toast(result.error ?? "エラーが発生しました");
        alert(result.error ?? "エラーが発生しました");
        setSubmitting(false);
        return;
      }
      setShowRejectDialog(false);
      toast("追加工事を辞退しました");
      setTimeout(() => router.back(), 1000);
    } catch (e) {
      setShowRejectDialog(false);
      const msg = e instanceof Error ? e.message : "エラーが発生しました";
      toast(msg);
      alert(msg);
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await confirmAdditionalOrder(orderId);
      if (!result.success) {
        setShowConfirmDialog(false);
        toast(result.error ?? "エラーが発生しました");
        alert(result.error ?? "エラーが発生しました");
        setSubmitting(false);
        return;
      }
      setShowConfirmDialog(false);
      toast("追加注文書を作成しました");
      setTimeout(() => router.back(), 1000);
    } catch (e) {
      setShowConfirmDialog(false);
      const msg = e instanceof Error ? e.message : "エラーが発生しました";
      toast(msg);
      alert(msg);
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
    return <div className="p-4 text-center text-knock-text-muted">追加工事が見つかりません</div>;
  }

  const items = order.additionalItems;
  const subtotal = items.reduce((sum, p) => sum + Math.ceil(p.quantity * p.priceUnit), 0);
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  const statusLabel: Record<string, { text: string; color: string; bg: string }> = {
    PENDING: { text: "承諾待ち", color: "#D97706", bg: "#FEF3C7" },
    APPROVED: { text: "承諾済み・確定待ち", color: "#2563EB", bg: "#DBEAFE" },
    CONFIRMED: { text: "確定済み", color: "#059669", bg: "#D1FAE5" },
    REJECTED: { text: "辞退", color: "#DC2626", bg: "#FEE2E2" },
  };
  const status = statusLabel[order.status ?? ""] ?? { text: order.status, color: "#666", bg: "#F3F4F6" };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F5F5F5]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[17px] font-bold tracking-wide text-knock-text">追加工事の確認</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
        {/* Status badge */}
        <div className="flex justify-center">
          <span
            className="rounded-full px-4 py-1.5 text-[13px] font-bold"
            style={{ color: status.color, backgroundColor: status.bg }}
          >
            {status.text}
          </span>
        </div>

        {/* Site info */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-[12px] font-bold text-knock-text-secondary">現場</span>
              <p className="text-[14px] font-semibold text-knock-text">{order.factoryFloor.name ?? ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[12px] font-bold text-knock-text-secondary">発注者</span>
                <p className="text-[13px] text-knock-text">{order.factoryFloor.company?.name ?? ""}</p>
              </div>
              <div>
                <span className="text-[12px] font-bold text-knock-text-secondary">受注者</span>
                <p className="text-[13px] text-knock-text">{order.factoryFloor.workCompany?.name ?? ""}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Price details */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
          <h2 className="mb-3 text-[13px] font-bold text-knock-text-secondary">追加工事 明細</h2>
          <div className="flex flex-col gap-3">
            {items.map((item, i) => (
              <div key={i} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="flex items-start justify-between">
                  <span className="text-[14px] font-semibold text-knock-text">{item.name}</span>
                  <span className="text-[14px] font-bold text-knock-text">
                    {formatCurrency(Math.ceil(item.quantity * item.priceUnit))}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[12px] text-knock-text-secondary">
                  <span>{item.quantity} {item.unitName}</span>
                  <span>@ {formatCurrency(item.priceUnit)}</span>
                </div>
                {item.specifications && (
                  <p className="mt-1 text-[12px] text-knock-text-muted">{item.specifications}</p>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-4 border-t border-gray-200 pt-3">
            <div className="flex flex-col gap-1 text-[14px]">
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">小計</span>
                <span className="text-knock-text">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">消費税（10%）</span>
                <span className="text-knock-text">{formatCurrency(tax)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t pt-1">
                <span className="font-bold text-knock-text">合計金額（税込）</span>
                <span className="font-bold" style={{ color: "#EA580C" }}>
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {/* 受注者: PENDING → 承諾 / 辞退 */}
        {!order.isOrderer && order.status === "PENDING" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowAcceptDialog(true)}
              disabled={submitting}
              className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ backgroundColor: "#EA580C" }}
            >
              承諾する
            </button>
            <button
              onClick={() => setShowRejectDialog(true)}
              disabled={submitting}
              className="w-full rounded-xl border-2 border-gray-300 py-3.5 text-[15px] font-bold text-knock-text-secondary transition-all active:scale-[0.97] disabled:opacity-50"
            >
              辞退する
            </button>
          </div>
        )}

        {/* 発注者: APPROVED → 注文書作成 */}
        {order.isOrderer && order.status === "APPROVED" && (
          <button
            onClick={() => setShowConfirmDialog(true)}
            disabled={submitting}
            className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: "#EA580C" }}
          >
            注文書を作成する
          </button>
        )}
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={showAcceptDialog}
        onClose={() => setShowAcceptDialog(false)}
        onConfirm={handleAccept}
        title="追加工事の承諾"
        message="この追加工事を承諾しますか？"
        confirmLabel={submitting ? "処理中..." : "承諾する"}
        cancelLabel="キャンセル"
        variant="primary"
      />
      <ConfirmDialog
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onConfirm={handleReject}
        title="追加工事の辞退"
        message="この追加工事を辞退しますか？辞退すると元に戻せません。"
        confirmLabel={submitting ? "処理中..." : "辞退する"}
        cancelLabel="キャンセル"
        variant="danger"
      />
      <ConfirmDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirm}
        title="追加注文書の作成確認"
        message={`合計 ${formatCurrency(total)} の追加注文書を作成しますか？作成後、受注者にも通知されます。`}
        confirmLabel={submitting ? "処理中..." : "作成する"}
        cancelLabel="キャンセル"
        variant="primary"
      />
    </div>
  );
}
