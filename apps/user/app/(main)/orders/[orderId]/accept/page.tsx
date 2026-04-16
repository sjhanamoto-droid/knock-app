"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMode } from "@/lib/hooks/use-mode";
import { getOrderDetail, acceptOrder, rejectOrder } from "@/lib/actions/orders";
import { getNegotiationRoomId } from "@/lib/actions/chat";
import { formatCurrency } from "@knock/utils";
import { ConfirmDialog, AlertDialog, useToast } from "@knock/ui";

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="48" height="4" viewBox="0 0 48 4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 2 Q6 0 12 2 Q18 4 24 2 Q30 0 36 2 Q42 4 48 2"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

type OrderDetail = Awaited<ReturnType<typeof getOrderDetail>>;

export default function OrderAcceptPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { accentColor } = useMode();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [redirectPath, setRedirectPath] = useState("/");

  useEffect(() => {
    getOrderDetail(orderId)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleAccept() {
    setSubmitting(true);
    try {
      await acceptOrder(orderId);
      setShowAcceptDialog(false);
      setRedirectPath(`/sites/${order?.factoryFloor?.id}`);
      setSuccessMessage("受注を確定しました");
    } catch (e) {
      setShowAcceptDialog(false);
      toast(e instanceof Error ? e.message : "エラーが発生しました");
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    try {
      await rejectOrder(orderId);
      setShowRejectDialog(false);
      setRedirectPath("/");
      setSuccessMessage("発注を辞退しました");
    } catch (e) {
      setShowRejectDialog(false);
      toast(e instanceof Error ? e.message : "エラーが発生しました");
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

  // 既にアクション済みの場合はボタンを無効化し、リダイレクト
  if (order.status !== "PENDING") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <span className="text-[14px] text-knock-text-secondary">この発注は既に処理済みです</span>
        <button
          onClick={() => router.replace(`/sites/${order.factoryFloor?.id ?? ""}`)}
          className="rounded-xl px-6 py-2.5 text-[14px] font-bold text-white"
          style={{ backgroundColor: accentColor }}
        >
          現場へ移動
        </button>
      </div>
    );
  }

  const floor = order.factoryFloor;
  const priceDetailsTotal = (floor.priceDetails ?? []).reduce(
    (sum: number, d: { quantity: number; priceUnit: number | bigint }) =>
      sum + Math.ceil((d.quantity ?? 0) * Number(d.priceUnit ?? 0)),
    0
  );
  const subtotal = priceDetailsTotal > 0 ? priceDetailsTotal : Number(floor.totalAmount ?? 0);
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">発注依頼</h1>
            <WavyUnderline color={accentColor} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-3 pb-8 bg-[#F5F5F5]">
        <div className="rounded-xl bg-blue-50 p-3 text-center">
          <span className="text-[14px] font-bold text-knock-blue">
            発注依頼が届いています
          </span>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] border-l-4" style={{ borderLeftColor: accentColor }}>
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-[12px] font-bold text-knock-text-secondary">発注元</span>
              <p className="text-[14px] font-semibold text-knock-text">
                {floor.company?.name ?? ""} 様
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
                  <span className="text-knock-text-secondary">消費税（10%）</span>
                  <span className="text-knock-text">{formatCurrency(tax)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t pt-1">
                  <span className="font-bold text-knock-text">合計金額（税込）</span>
                  <span className="text-[16px] font-bold" style={{ color: accentColor }}>
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
          onClick={() => setShowAcceptDialog(true)}
          disabled={submitting}
          className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          {submitting ? "処理中..." : "受注する"}
        </button>

        <button
          onClick={async () => {
            const roomId = await getNegotiationRoomId(floor.company?.id ?? "");
            if (roomId) {
              router.push(`/chat/${roomId}`);
            } else {
              toast("交渉チャットルームが見つかりません");
            }
          }}
          className="w-full rounded-xl border-2 py-3.5 text-[15px] font-bold transition-all active:scale-[0.97]"
          style={{ borderColor: accentColor, color: accentColor }}
        >
          条件を相談する（チャット）
        </button>

        <button
          onClick={() => setShowRejectDialog(true)}
          disabled={submitting}
          className="w-full rounded-xl border-2 border-gray-300 py-3.5 text-[15px] font-bold text-knock-text-secondary transition-all active:scale-[0.97] disabled:opacity-50"
        >
          辞退する
        </button>
      </div>

      {/* 受注確認ダイアログ */}
      <ConfirmDialog
        open={showAcceptDialog}
        onClose={() => setShowAcceptDialog(false)}
        onConfirm={handleAccept}
        title="受注の確認"
        message="この発注を受注しますか？受注後は現場の作業を進めてください。"
        confirmLabel={submitting ? "処理中..." : "受注する"}
        cancelLabel="キャンセル"
        variant="primary"
      />

      {/* 辞退確認ダイアログ */}
      <ConfirmDialog
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onConfirm={handleReject}
        title="辞退の確認"
        message="この発注を辞退しますか？辞退すると発注元に通知されます。"
        confirmLabel={submitting ? "処理中..." : "辞退する"}
        cancelLabel="キャンセル"
        variant="danger"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => router.replace(redirectPath)}
        title="完了"
        message={successMessage}
      />
    </div>
  );
}
