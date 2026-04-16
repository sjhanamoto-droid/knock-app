"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getOrder, acceptOrder, rejectOrder, cancelOrder } from "@/lib/actions/orders";
import { orderStatusLabels, orderStatusColors, formatDate, formatCurrency } from "@knock/utils";
import { ConfirmDialog, AlertDialog, useToast } from "@knock/ui";
import { useMode } from "@/lib/hooks/use-mode";

type OrderDetail = Awaited<ReturnType<typeof getOrder>>;

const cardClass = "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";
const labelClass = "text-[12px] text-knock-text-secondary";

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
      <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { accentColor } = useMode();
  const [order, setOrder] = useState<OrderDetail>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "cancel" | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    getOrder(params.orderId as string)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [params.orderId]);

  const isOrderer = order ? order.factoryFloor.companyId === order.viewerCompanyId : false;

  async function handleAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const fn = { approve: acceptOrder, reject: rejectOrder, cancel: cancelOrder }[confirmAction];
      await fn(params.orderId as string);
      const updated = await getOrder(params.orderId as string);
      setOrder(updated);
      const labels = { approve: "承認しました", reject: "辞退しました", cancel: "キャンセルしました" };
      setSuccessMessage(labels[confirmAction]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
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
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <span className="text-[14px] text-gray-400">発注が見つかりません</span>
        <button
          onClick={() => router.back()}
          className="text-[13px] font-semibold text-knock-blue"
        >
          戻る
        </button>
      </div>
    );
  }

  // 相手企業
  const counterpart = isOrderer
    ? order.factoryFloor.workCompany
    : order.factoryFloor.company;

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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">発注詳細</h1>
            <WavyUnderline color={accentColor} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-3 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {/* ステータス & 現場名 */}
        <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
          <div className="flex items-start justify-between">
            <h2 className="text-[16px] font-bold text-knock-text">
              {order.factoryFloor.name ?? "名称未設定"}
            </h2>
            {order.status && (
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${orderStatusColors[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                {orderStatusLabels[order.status] ?? order.status}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {order.factoryFloor.address && (
              <div>
                <span className={labelClass}>住所</span>
                <p className="text-[14px] text-knock-text">{order.factoryFloor.address}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={labelClass}>工期開始</span>
                <p className="text-[14px] text-knock-text">
                  {order.factoryFloor.startDayRequest ? formatDate(new Date(order.factoryFloor.startDayRequest)) : "未設定"}
                </p>
              </div>
              <div>
                <span className={labelClass}>工期終了</span>
                <p className="text-[14px] text-knock-text">
                  {order.factoryFloor.endDayRequest ? formatDate(new Date(order.factoryFloor.endDayRequest)) : "未設定"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 相手企業 */}
        {counterpart && (
          <div className={cardClass}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-knock-text-secondary">
              {isOrderer ? "発注先" : "発注元"}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[14px] font-bold text-gray-400">
                {counterpart.name?.charAt(0) ?? "?"}
              </div>
              <p className="text-[15px] font-bold text-knock-text">
                {counterpart.name ?? "名称未設定"}
              </p>
            </div>
          </div>
        )}

        {/* メッセージ */}
        {order.message && (
          <div className={cardClass}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-knock-text-secondary">
              メッセージ
            </p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-knock-text">
              {order.message}
            </p>
          </div>
        )}

        {/* 明細 */}
        {order.factoryFloor.priceDetails.length > 0 && (
          <div className={cardClass}>
            <h3 className="mb-3 text-[14px] font-bold text-knock-text">明細</h3>
            <div className="flex flex-col gap-2">
              {order.factoryFloor.priceDetails.map((detail) => (
                <div key={detail.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-knock-text">{detail.name}</p>
                    <p className="text-[11px] text-knock-text-secondary">
                      {detail.quantity} {detail.unit?.name ?? ""} × {formatCurrency(Number(detail.priceUnit))}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold text-knock-text">
                    {formatCurrency(Math.ceil(detail.quantity * Number(detail.priceUnit)))}
                  </span>
                </div>
              ))}
              {(() => {
                const detailsSubtotal = order.factoryFloor.priceDetails.reduce(
                  (sum, d) => sum + Math.ceil(d.quantity * Number(d.priceUnit)),
                  0
                );
                const detailsTax = Math.floor(detailsSubtotal * 0.1);
                return (
                  <div className="mt-1 flex flex-col gap-0.5 border-t border-gray-200 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-knock-text-secondary">小計</span>
                      <span className="text-[13px] text-knock-text">{formatCurrency(detailsSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-knock-text-secondary">消費税（10%）</span>
                      <span className="text-[13px] text-knock-text">{formatCurrency(detailsTax)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between border-t border-gray-100 pt-1">
                      <span className="text-[13px] font-bold text-knock-text">合計金額（税込）</span>
                      <span className="text-[15px] font-bold text-blue-600">
                        {formatCurrency(detailsSubtotal + detailsTax)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 現場詳細リンク */}
        <Link
          href={`/sites/${order.factoryFloor.id}`}
          className="flex items-center justify-center gap-2 text-[13px] font-semibold text-knock-blue"
        >
          現場詳細を見る
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 2L6.5 5L3.5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Link>

        {/* アクション: 受注者 - 発注依頼を受諾/辞退 */}
        {!isOrderer && order.status === "PENDING" && (
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmAction("reject")}
              disabled={actionLoading}
              className="flex-1 rounded-xl border border-gray-300 py-3.5 text-[14px] font-bold text-gray-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              辞退する
            </button>
            <button
              onClick={() => setConfirmAction("approve")}
              disabled={actionLoading}
              className="flex-1 rounded-xl bg-knock-orange py-3.5 text-[14px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              受諾する
            </button>
          </div>
        )}

        {/* アクション: 発注者 - キャンセル */}
        {isOrderer && (order.status === "PENDING" || order.status === "APPROVED") && (
          <button
            onClick={() => setConfirmAction("cancel")}
            disabled={actionLoading}
            className="rounded-xl border border-red-300 py-3.5 text-[14px] font-bold text-red-600 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            発注をキャンセル
          </button>
        )}

        {/* アクション: 発注者 - 注文書発行（APPROVED→CONFIRMED） */}
        {isOrderer && order.status === "APPROVED" && (
          <Link
            href={`/orders/${order.id}/confirm`}
            className="rounded-xl bg-blue-500 py-3.5 text-center text-[14px] font-bold text-white shadow-sm transition-all active:scale-[0.98]"
          >
            注文書を発行する
          </Link>
        )}

        {/* アクション: 受注者 - 完了報告 */}
        {!isOrderer && order.status === "CONFIRMED" && (
          <Link
            href={`/orders/${order.id}/completion-report`}
            className="rounded-xl bg-green-500 py-3.5 text-center text-[14px] font-bold text-white shadow-sm transition-all active:scale-[0.98]"
          >
            完了報告を送信
          </Link>
        )}

        {/* アクション: 発注者 - 完了報告の確認（検収前） */}
        {isOrderer && order.factoryFloor.status === "INSPECTION" && (
          <Link
            href={`/orders/${order.id}/completion-review`}
            className="rounded-xl bg-blue-500 py-3.5 text-center text-[14px] font-bold text-white shadow-sm transition-all active:scale-[0.98]"
          >
            完了報告を確認
          </Link>
        )}

        {/* アクション: 受注者 - 納品承認 */}
        {!isOrderer && order.factoryFloor.status === "COMPLETED" && (
          <Link
            href={`/orders/${order.id}/delivery-approval`}
            className="rounded-xl bg-green-500 py-3.5 text-center text-[14px] font-bold text-white shadow-sm transition-all active:scale-[0.98]"
          >
            納品金額を確認
          </Link>
        )}
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        open={confirmAction === "approve"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAction}
        title="発注を受諾"
        message={`${order.factoryFloor.name ?? "この現場"}の発注を受諾しますか？`}
        confirmLabel={actionLoading ? "処理中..." : "受諾する"}
        cancelLabel="キャンセル"
        variant="primary"
      />
      <ConfirmDialog
        open={confirmAction === "reject"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAction}
        title="発注を辞退"
        message={`${order.factoryFloor.name ?? "この現場"}の発注を辞退しますか？この操作は取り消せません。`}
        confirmLabel={actionLoading ? "処理中..." : "辞退する"}
        cancelLabel="キャンセル"
        variant="danger"
      />
      <ConfirmDialog
        open={confirmAction === "cancel"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAction}
        title="発注をキャンセル"
        message={`${order.factoryFloor.name ?? "この現場"}の発注をキャンセルしますか？`}
        confirmLabel={actionLoading ? "処理中..." : "キャンセルする"}
        cancelLabel="戻る"
        variant="danger"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => {
          setSuccessMessage("");
          router.replace(`/orders/${params.orderId}`);
        }}
        title="完了"
        message={successMessage}
      />
    </div>
  );
}
