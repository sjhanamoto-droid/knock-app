"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getWorkCompletion, requestCloseFloor, approveCloseFloor, rejectCloseFloor } from "@/lib/actions/orders";
import { ConfirmDialog, AlertDialog, useToast } from "@knock/ui";
import { orderCompletionStatusLabels, orderCompletionStatusColors } from "@knock/utils";

type WorkCompletion = NonNullable<Awaited<ReturnType<typeof getWorkCompletion>>>;
type WorkOrder = WorkCompletion["orders"][number];

const cardClass = "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="60" height="6" viewBox="0 0 60 6" fill="none">
      <path
        d="M0 3 Q7.5 0 15 3 Q22.5 6 30 3 Q37.5 0 45 3 Q52.5 6 60 3"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface Props {
  data: WorkCompletion;
  floorId: string;
}

export function WorkCompletionClient({ data, floorId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { accentColor } = useMode();
  const [submitting, setSubmitting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [completedDay, setCompletedDay] = useState(new Date().toISOString().split("T")[0]);
  const [successMessage, setSuccessMessage] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { orders, isOrderer } = data;

  const allReported = orders.length > 0 && orders.every((o) => o.hasReport);
  const allClosed = orders.length > 0 && orders.every((o) => o.completionStatus === "CLOSED");
  const anyCloseRequested = orders.some((o) => o.completionStatus === "CLOSE_REQUESTED");
  const anyNone = orders.some((o) => o.completionStatus === "NONE");
  const allNone = orders.length > 0 && orders.every((o) => o.completionStatus === "NONE");
  const canRequestClose = allReported && anyNone;

  const latestCompletedDay = orders
    .map((o) => o.completedDay)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  async function handleRequestClose() {
    setShowCloseConfirm(false);
    setSubmitting(true);
    try {
      await requestCloseFloor(floorId);
      setSuccessMessage("工事の完了(締め)を依頼しました");
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveClose() {
    setShowApproveConfirm(false);
    setSubmitting(true);
    try {
      await approveCloseFloor(floorId, completedDay);
      setSuccessMessage("工事完了を承認しました");
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRejectClose() {
    setShowRejectConfirm(false);
    setSubmitting(true);
    try {
      await rejectCloseFloor(floorId);
      setSuccessMessage("工事完了を差し戻しました");
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  function orderLabel(order: WorkOrder, index: number) {
    return order.isAdditional ? "追加工事" : `発注書 ${index + 1}`;
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M13 4L7 10L13 16"
                stroke="#1A1A1A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">工事完了</h1>
            <WavyUnderline color={accentColor} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {data.parentName ? (
          <div className="flex flex-col gap-0.5">
            <p className="text-[13px] text-knock-text-secondary">現場名: {data.parentName}</p>
            <p className="text-[13px] font-semibold text-knock-text">工事名: {data.name ?? ""}</p>
          </div>
        ) : (
          <p className="text-[13px] text-knock-text-secondary">{data.name ?? ""}</p>
        )}

        {/* 注文書一覧 */}
        <div className="flex flex-col gap-3">
          {orders.length === 0 ? (
            <div className={cardClass}>
              <p className="text-[13px] text-knock-text-secondary">対象の発注書はありません。</p>
            </div>
          ) : (
            orders.map((order, i) => {
              const expanded = expandedId === order.id;
              return (
                <div
                  key={order.id}
                  className={`${cardClass} flex flex-col gap-2 border-l-4`}
                  style={{ borderLeftColor: accentColor }}
                >
                  <button
                    onClick={() => setExpandedId(expanded ? null : order.id)}
                    className="flex flex-col gap-2 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-knock-text">{orderLabel(order, i)}</p>
                        {order.orderSheet && (
                          <p className="truncate text-[11px] text-knock-text-secondary">
                            {order.orderSheet.documentNumber}
                          </p>
                        )}
                      </div>
                      {(() => {
                        // 未締め(NONE)でも施工報告済みなら「施工報告済み」を表示する
                        const reported = order.completionStatus === "NONE" && order.hasReport;
                        const label = reported
                          ? "施工報告済み"
                          : orderCompletionStatusLabels[order.completionStatus] ?? order.completionStatus;
                        const color = reported
                          ? "bg-green-100 text-green-700"
                          : orderCompletionStatusColors[order.completionStatus] ?? "bg-gray-100 text-gray-600";
                        return (
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${color}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          order.hasReport ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {order.hasReport ? "施工報告 済" : "施工報告 未"}
                      </span>
                      <div className="flex items-center gap-2">
                        {order.orderSheet && (
                          <span className="text-[14px] font-bold text-knock-text">
                            ¥{order.orderSheet.totalAmount.toLocaleString()}
                          </span>
                        )}
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                        >
                          <path d="M3.5 5L7 8.5L10.5 5" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-1 flex flex-col gap-2 border-t border-gray-100 pt-3">
                      <p className="text-[12px] font-bold text-knock-text-secondary">
                        {order.isAdditional ? "追加工事の明細" : "発注の明細"}
                      </p>
                      {order.items.length === 0 ? (
                        <p className="text-[12px] text-knock-text-secondary">明細はありません</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {order.items.map((it, idx) => (
                            <div
                              key={idx}
                              className="flex items-start justify-between gap-2 rounded-lg bg-[#F7F7F7] px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-knock-text">{it.name}</p>
                                <p className="text-[11px] text-knock-text-secondary">
                                  {it.quantity}
                                  {it.unitName ?? ""} × ¥{it.priceUnit.toLocaleString()}
                                  {it.specifications ? ` / ${it.specifications}` : ""}
                                </p>
                              </div>
                              <span className="shrink-0 text-[13px] font-bold text-knock-text">
                                ¥{it.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between px-1 pt-1">
                            <span className="text-[12px] text-knock-text-secondary">小計（税抜）</span>
                            <span className="text-[13px] font-bold text-knock-text">
                              ¥{order.subtotal.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => router.push(`/orders/${order.id}/completion-report`)}
                        className="mt-1 w-full rounded-xl border-2 py-2.5 text-[13px] font-bold transition-all active:scale-[0.98]"
                        style={{ borderColor: accentColor, color: accentColor }}
                      >
                        {order.hasReport ? "施工報告を確認" : "施工報告を提出"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* フッターアクション */}
        {orders.length > 0 &&
          (isOrderer ? (
            /* ===== 発注者 ===== */
            allClosed ? (
              <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
                <p className="text-[15px] font-bold text-knock-text">完了</p>
                {latestCompletedDay && (
                  <p className="mt-1.5 text-[13px] text-knock-text-secondary">
                    工事完了日: {new Date(latestCompletedDay).toLocaleDateString("ja-JP")}
                  </p>
                )}
              </div>
            ) : anyCloseRequested ? (
              <div className={cardClass}>
                <label className="mb-1 block text-[13px] font-bold text-knock-text">工事完了日</label>
                <input
                  type="date"
                  value={completedDay}
                  onChange={(e) => setCompletedDay(e.target.value)}
                  className="mb-4 w-full rounded-xl border-none bg-[#F0F0F0] px-4 py-3 text-[14px]"
                />
                <button
                  onClick={() => setShowApproveConfirm(true)}
                  disabled={submitting}
                  className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {submitting ? "処理中..." : "工事完了を承認"}
                </button>
                <button
                  onClick={() => setShowRejectConfirm(true)}
                  disabled={submitting}
                  className="mt-3 w-full rounded-xl border-2 py-3.5 text-[15px] font-bold transition-all active:scale-[0.97] disabled:opacity-50"
                  style={{ borderColor: accentColor, color: accentColor }}
                >
                  差し戻す
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
                <p className="text-[15px] font-bold text-knock-text">受注者の締め依頼待ち</p>
                <p className="mt-1.5 text-[13px] text-knock-text-secondary">
                  受注者が工事を締めると、ここで承認できます。
                </p>
              </div>
            )
          ) : /* ===== 受注者 ===== */
          allClosed ? (
            <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <p className="text-[15px] font-bold text-knock-text">完了</p>
              {latestCompletedDay && (
                <p className="mt-1.5 text-[13px] text-knock-text-secondary">
                  工事完了日: {new Date(latestCompletedDay).toLocaleDateString("ja-JP")}
                </p>
              )}
            </div>
          ) : anyCloseRequested && !anyNone ? (
            <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <p className="text-[15px] font-bold text-knock-text">発注者の確認待ち</p>
              <p className="mt-1.5 text-[13px] text-knock-text-secondary">
                発注者が工事完了を承認すると締め処理が完了します。
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowCloseConfirm(true)}
                disabled={submitting || !canRequestClose}
                className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {submitting ? "処理中..." : "工事を締める"}
              </button>
              {!canRequestClose && (
                <p className="text-center text-[12px] text-knock-text-secondary">
                  すべての発注書の施工報告が必要です
                </p>
              )}
            </div>
          ))}
      </div>

      <ConfirmDialog
        open={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleRequestClose}
        title="工事完了(締め)の依頼"
        message="全ての工事を締めますか？発注者に工事完了の確認を依頼します。"
        confirmLabel={submitting ? "処理中..." : "締める"}
        cancelLabel="キャンセル"
        variant="primary"
      />
      <ConfirmDialog
        open={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={handleApproveClose}
        title="工事完了の承認"
        message="工事完了を承認しますか？"
        confirmLabel={submitting ? "処理中..." : "承認する"}
        cancelLabel="キャンセル"
        variant="primary"
      />
      <ConfirmDialog
        open={showRejectConfirm}
        onClose={() => setShowRejectConfirm(false)}
        onConfirm={handleRejectClose}
        title="工事完了の差し戻し"
        message="工事完了を差し戻しますか？受注者に差し戻されます。"
        confirmLabel={submitting ? "処理中..." : "差し戻す"}
        cancelLabel="キャンセル"
        variant="danger"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => {
          setSuccessMessage("");
          router.refresh();
        }}
        title="完了"
        message={successMessage}
      />
    </div>
  );
}
