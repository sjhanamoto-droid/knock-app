"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getWorkCompletion } from "@/lib/actions/orders";

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

// 発注書ごとの完了バッジ。受注者の施工報告の提出＝完了。
function completionBadge(order: WorkOrder): { label: string; color: string } {
  // 回答待ちの発注（追加工事の依頼中など）は注文書がまだ無い
  if (order.status === "PENDING") {
    return { label: "回答待ち", color: "bg-amber-100 text-amber-700" };
  }
  if (order.status === "APPROVED") {
    return { label: "発注確定待ち", color: "bg-amber-100 text-amber-700" };
  }
  if (order.completionStatus === "CLOSED") {
    return { label: "完了", color: "bg-green-100 text-green-700" };
  }
  // 発注者が差し戻した(または旧フローで報告のみ済んだ)発注書: 報告はあるが未完了。再送信で完了になる。
  if (order.hasReport) {
    return { label: "施工報告 再送信待ち", color: "bg-amber-100 text-amber-700" };
  }
  return { label: "施工報告 未提出", color: "bg-gray-100 text-gray-600" };
}

interface Props {
  data: WorkCompletion;
}

/**
 * 工事完了画面（現場全体）。
 * 発注書(注文書)ごとに施工報告を提出すると、その発注書が完了し完了月の請求対象になる。
 * すべての発注書が完了すると現場は「工事完了」。発注者が追加工事を依頼すると「施工中」に戻り、
 * 追加分の施工報告で再び「工事完了」になる（締め依頼・承認の手順は無い）。
 */
export function WorkCompletionClient({ data }: Props) {
  const router = useRouter();
  const { accentColor } = useMode();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { orders, isOrderer } = data;

  // 現場全体の完了はサーバーのロールアップ結果(現場ステータス)を正とする
  const floorCompleted = data.status === "COMPLETED";
  const remaining = orders.filter(
    (o) => !(o.status === "CONFIRMED" && o.completionStatus === "CLOSED")
  ).length;

  const latestCompletedDay = orders
    .map((o) => o.completedDay)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

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
              const badge = completionBadge(order);
              const confirmed = order.status === "CONFIRMED";
              const closed = confirmed && order.completionStatus === "CLOSED";
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
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-knock-text-secondary">
                        {order.completedDay
                          ? `完了日: ${new Date(order.completedDay).toLocaleDateString("ja-JP")}`
                          : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        {order.orderSheet ? (
                          <span className="text-[14px] font-bold text-knock-text">
                            ¥{order.orderSheet.totalAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[14px] font-bold text-knock-text">
                            ¥{order.subtotal.toLocaleString()}
                            <span className="ml-1 text-[10px] font-normal text-knock-text-secondary">税抜</span>
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

                  {/* 施工報告アクション（受注者: 提出＝完了 / 発注者: 確認）。回答待ちの発注は回答へ誘導 */}
                  {!confirmed ? (
                    !isOrderer && order.status === "PENDING" && (
                      <button
                        onClick={() =>
                          router.push(
                            order.isAdditional ? `/orders/${order.id}/additional-review` : `/orders/${order.id}/accept`
                          )
                        }
                        className="w-full rounded-xl py-2.5 text-[13px] font-bold text-white transition-all active:scale-[0.98]"
                        style={{ backgroundColor: accentColor }}
                      >
                        {order.isAdditional ? "追加工事依頼に回答する" : "発注依頼に回答する"}
                      </button>
                    )
                  ) : isOrderer ? (
                    order.hasReport && (
                      <button
                        onClick={() => router.push(`/orders/${order.id}/completion-report`)}
                        className="w-full rounded-xl border-2 py-2.5 text-[13px] font-bold transition-all active:scale-[0.98]"
                        style={{ borderColor: accentColor, color: accentColor }}
                      >
                        施工報告を確認
                      </button>
                    )
                  ) : closed ? (
                    <button
                      onClick={() => router.push(`/orders/${order.id}/completion-report`)}
                      className="w-full rounded-xl border-2 py-2.5 text-[13px] font-bold transition-all active:scale-[0.98]"
                      style={{ borderColor: accentColor, color: accentColor }}
                    >
                      施工報告を確認
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(`/orders/${order.id}/completion-report`)}
                      className="w-full rounded-xl py-2.5 text-[13px] font-bold text-white transition-all active:scale-[0.98]"
                      style={{ backgroundColor: accentColor }}
                    >
                      施工報告を提出して完了する
                    </button>
                  )}

                  {/* この工事(現場)の詳細へ。発注内容・注文書・完了状況は現場詳細でまとめて確認できる */}
                  <button
                    onClick={() => router.push(`/sites/${data.id}`)}
                    className="w-full rounded-xl border border-gray-300 py-2.5 text-[13px] font-bold text-knock-text transition-all active:scale-[0.98] active:bg-gray-50"
                  >
                    この工事の詳細を見る
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
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 現場全体の状態 */}
        {orders.length > 0 &&
          (floorCompleted ? (
            <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <p className="text-[15px] font-bold text-knock-text">工事完了</p>
              {latestCompletedDay && (
                <p className="mt-1.5 text-[13px] text-knock-text-secondary">
                  工事完了日: {new Date(latestCompletedDay).toLocaleDateString("ja-JP")}
                </p>
              )}
              <p className="mt-2 text-[12px] text-knock-text-secondary">
                各発注書の注文書金額は、完了した月の請求対象になります。
                {isOrderer ? "追加工事を依頼すると、現場は施工中に戻ります。" : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <p className="text-[15px] font-bold text-knock-text">
                {isOrderer ? "受注者の施工報告待ち" : "施工報告が未提出の発注書があります"}
              </p>
              <p className="mt-1.5 text-[13px] text-knock-text-secondary">
                {isOrderer
                  ? `受注者がすべての発注書の施工報告を提出すると工事完了になります（残り${remaining}件）。`
                  : `施工報告を提出した発注書から順に完了し、その月の請求対象になります。すべて提出すると工事完了です（残り${remaining}件）。`}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
