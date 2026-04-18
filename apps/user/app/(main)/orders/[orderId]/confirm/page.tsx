"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMode } from "@/lib/hooks/use-mode";
import { getOrderDetail, confirmOrder, cancelOrder } from "@/lib/actions/orders";
import { formatCurrency } from "@knock/utils";
import { ConfirmDialog, useToast } from "@knock/ui";
import { OrderSheetPreview } from "@/components/order-sheet-preview";

type OrderDetail = Awaited<ReturnType<typeof getOrderDetail>>;

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="80" height="6" viewBox="0 0 80 6" fill="none">
      <path
        d="M0 3 Q10 0 20 3 Q30 6 40 3 Q50 0 60 3 Q70 6 80 3"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function OrderConfirmPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { accentColor } = useMode();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"details" | "preview">("details");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    getOrderDetail(orderId)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await confirmOrder(orderId);
      setShowConfirmDialog(false);
      toast("注文書を作成しました");
      setTimeout(() => {
        router.replace(`/sites/${order?.factoryFloor?.id}`);
      }, 1000);
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
      toast("発注をキャンセルしました");
      setTimeout(() => {
        router.replace("/sites");
      }, 1000);
    } catch (e) {
      setShowCancelDialog(false);
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
    return <div className="p-4 text-center text-knock-text-muted">発注が見つかりません</div>;
  }

  const floor = order.factoryFloor;
  const priceDetails = floor.priceDetails ?? [];
  const priceDetailsTotal = priceDetails.reduce(
    (sum: number, d: { quantity: number | null; priceUnit: number | bigint | null }) =>
      sum + Math.ceil((d.quantity ?? 0) * Number(d.priceUnit ?? 0)),
    0
  );
  const subtotal = priceDetailsTotal > 0 ? priceDetailsTotal : Number(floor.totalAmount ?? 0);
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  // 注文書プレビュー表示
  if (step === "preview") {
    return (
      <div className="flex flex-col">
        <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setStep("details")}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
                注文書プレビュー
              </h1>
              <WavyUnderline color={accentColor} />
            </div>
            <div className="w-10" />
          </div>
        </header>

        <div className="flex flex-col gap-4 px-4 pt-3 pb-8 bg-[#F5F5F5]">
          <OrderSheetPreview
            orderCompany={floor.company}
            workerCompany={floor.workCompany}
            siteName={floor.name}
            siteAddress={floor.address}
            startDate={floor.startDayRequest}
            endDate={floor.endDayRequest}
            contentRequest={floor.contentRequest}
            priceDetails={priceDetails}
            subtotal={subtotal}
            taxAmount={tax}
            totalAmount={total}
            onConfirm={() => setShowConfirmDialog(true)}
            onBack={() => setStep("details")}
            submitting={submitting}
            accentColor={accentColor}
          />
        </div>

        {/* 注文書作成の確認ダイアログ */}
        <ConfirmDialog
          open={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirm}
          title="注文書の作成確認"
          message="この内容で注文書を作成しますか？作成後、受注者にも通知されます。"
          confirmLabel={submitting ? "処理中..." : "作成する"}
          cancelLabel="キャンセル"
          variant="primary"
        />
      </div>
    );
  }

  // 発注内容確認画面
  return (
    <div className="flex flex-col">
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
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
              発注内容の確認
            </h1>
            <WavyUnderline color={accentColor} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-3 pb-8 bg-[#F5F5F5]">
        <div
          className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] border-l-4"
          style={{ borderLeftColor: accentColor }}
        >
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-[12px] font-bold text-knock-text-secondary">発注先</span>
              <p className="text-[14px] font-semibold text-knock-text">
                {floor.workCompany?.name ?? ""} 様
              </p>
            </div>

            <div>
              <span className="text-[12px] font-bold text-knock-text-secondary">現場</span>
              <p className="text-[14px] font-semibold text-knock-text">{floor.name ?? "名称未設定"}</p>
              <p className="text-[12px] text-knock-text-secondary">{floor.address ?? ""}</p>
            </div>

            <div>
              <span className="text-[12px] font-bold text-knock-text-secondary">工期</span>
              <p className="text-[14px] text-knock-text">
                {floor.startDayRequest
                  ? new Date(floor.startDayRequest).toLocaleDateString("ja-JP")
                  : "未設定"}
                〜
                {floor.endDayRequest
                  ? new Date(floor.endDayRequest).toLocaleDateString("ja-JP")
                  : "未設定"}
              </p>
            </div>

            <div>
              <span className="text-[12px] font-bold text-knock-text-secondary">発注金額</span>
              <div className="mt-1 flex flex-col gap-0.5 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-knock-text-secondary">小計</span>
                  <span className="text-knock-text">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-knock-text-secondary">消費税</span>
                  <span className="text-knock-text">{formatCurrency(tax)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t pt-1">
                  <span className="font-bold text-knock-text">合計金額（税込）</span>
                  <span className="font-bold" style={{ color: accentColor }}>
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Link
            href={`/sites/${floor.id}`}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-[13px] font-semibold text-knock-text transition-colors active:bg-gray-100"
          >
            現場の詳細を確認する
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <button
          onClick={() => setStep("preview")}
          disabled={submitting}
          className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          発注を確定する
        </button>

        <button
          onClick={() => setShowCancelDialog(true)}
          disabled={submitting}
          className="w-full rounded-xl border-2 border-gray-300 py-3.5 text-[15px] font-bold text-knock-text-secondary transition-all active:scale-[0.97] disabled:opacity-50"
        >
          発注をキャンセルする
        </button>
      </div>

      {/* 発注キャンセルの確認ダイアログ */}
      <ConfirmDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancel}
        title="発注キャンセルの確認"
        message="この発注をキャンセルしますか？キャンセルすると元に戻せません。"
        confirmLabel={submitting ? "処理中..." : "キャンセルする"}
        cancelLabel="戻る"
        variant="danger"
      />
    </div>
  );
}
