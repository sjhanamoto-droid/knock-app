"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAdditionalOrderDetail,
  acceptAdditionalOrder,
  rejectAdditionalOrder,
  confirmAdditionalOrder,
  cancelOrder,
} from "@/lib/actions/orders";
import { formatCurrency } from "@knock/utils";
import { ConfirmDialog, useToast } from "@knock/ui";
import { ImageLightbox } from "@/components/image-lightbox";

// base64 の data URL はブラウザが新規タブで直接開けない(ブロックされる)ため、
// Blob に変換して object URL として開く。ポップアップブロック時はダウンロードにフォールバック。
function openDataUrl(dataUrl: string, filename: string) {
  try {
    const base64 = dataUrl.split(",")[1] ?? "";
    const mime = dataUrl.split(",")[0]?.split(":")[1]?.split(";")[0] ?? "application/octet-stream";
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mime });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank");
    if (!opened) {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch {
    window.open(dataUrl, "_blank");
  }
}

type OrderDetail = NonNullable<Awaited<ReturnType<typeof getAdditionalOrderDetail>>>;

interface Props {
  initialOrder: OrderDetail;
  orderId: string;
}

export function AdditionalReviewClient({ initialOrder, orderId }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [order] = useState<OrderDetail | null>(initialOrder);
  const [submitting, setSubmitting] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);

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

  async function handleCancel() {
    setSubmitting(true);
    try {
      await cancelOrder(orderId);
      setShowCancelDialog(false);
      toast("追加工事をキャンセルしました");
      setTimeout(() => router.back(), 1000);
    } catch (e) {
      setShowCancelDialog(false);
      const msg = e instanceof Error ? e.message : "エラーが発生しました";
      toast(msg);
      alert(msg);
      setSubmitting(false);
    }
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

        {/* 添付資料（見積書PDF・画像） */}
        {(order.estimatePdfUrls.length > 0 || order.imageUrls.length > 0) && (
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
            <h2 className="mb-3 text-[13px] font-bold text-knock-text-secondary">添付資料</h2>
            {order.estimatePdfUrls.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                {order.estimatePdfUrls.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openDataUrl(url, `見積書_${i + 1}.pdf`)}
                    className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-left text-[13px] font-semibold text-knock-text active:bg-gray-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M9 1.5H4C3.45 1.5 3 1.95 3 2.5V13.5C3 14.05 3.45 14.5 4 14.5H12C12.55 14.5 13 14.05 13 13.5V5.5L9 1.5Z" stroke="#EA580C" strokeWidth="1.2" strokeLinejoin="round" />
                      <path d="M9 1.5V5.5H13" stroke="#EA580C" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                    見積書{order.estimatePdfUrls.length > 1 ? ` ${i + 1}` : ""}を開く
                  </button>
                ))}
              </div>
            )}
            {order.imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {order.imageUrls.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setViewer({ images: order.imageUrls, index: i })}
                    className="block overflow-hidden rounded-lg border border-gray-200 transition-all active:scale-95"
                  >
                    <img src={url} alt={`追加工事画像${i + 1}`} className="h-24 w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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

        {/* 発注者: PENDING/APPROVED → 追加工事をキャンセル(他の工事には影響しない) */}
        {order.isOrderer && (order.status === "PENDING" || order.status === "APPROVED") && (
          <button
            onClick={() => setShowCancelDialog(true)}
            disabled={submitting}
            className="w-full rounded-xl border-2 border-gray-300 py-3.5 text-[15px] font-bold text-knock-text-secondary transition-all active:scale-[0.97] disabled:opacity-50"
          >
            追加工事をキャンセル
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
      <ConfirmDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancel}
        title="追加工事のキャンセル"
        message="この追加工事をキャンセルしますか？(本工事や他の追加工事には影響しません)"
        confirmLabel={submitting ? "処理中..." : "キャンセルする"}
        cancelLabel="戻る"
        variant="danger"
      />

      {viewer && (
        <ImageLightbox
          images={viewer.images}
          index={viewer.index}
          onClose={() => setViewer(null)}
          fileNamePrefix="追加工事画像"
        />
      )}
    </div>
  );
}
