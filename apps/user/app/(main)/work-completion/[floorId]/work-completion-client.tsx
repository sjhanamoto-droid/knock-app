"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getWorkCompletion } from "@/lib/actions/orders";
import { summarizeProgress, progressLabel, progressTax } from "@/lib/helpers/progress-billing";
import {
  TaxEx,
  yen,
  ProgressChip,
  ProgressBar,
  ProgressLegend,
  FinalTag,
} from "@/components/progress-billing-ui";

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

// 注文書が確定する前（回答待ち・発注確定待ち）のバッジ
function preConfirmBadge(order: WorkOrder): { label: string; color: string } | null {
  if (order.status === "PENDING") return { label: "回答待ち", color: "bg-amber-100 text-amber-700" };
  if (order.status === "APPROVED") return { label: "発注確定待ち", color: "bg-amber-100 text-amber-700" };
  return null;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ja-JP");
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** 発注書の出来高集計（注文書金額＝税抜） */
function orderProgress(order: WorkOrder) {
  const orderAmount = order.orderSheet?.subtotal ?? order.subtotal;
  return summarizeProgress(orderAmount, order.progress, order.completionStatus === "CLOSED");
}

interface Props {
  data: WorkCompletion;
}

/**
 * 工事完了画面（現場全体）。
 * 発注書(注文書)ごとに「完了を報告する」から、すべて完了（施工報告）か一部だけ完了（出来高）を報告する。
 * - 施工報告: 送信で発注書が完了し、完了月の請求対象になる
 * - 出来高: 発注者の確定で申請月の請求対象になる。残りすべての出来高が確定すると発注書は完了
 * すべての発注書が完了すると現場は「工事完了」。追加工事の依頼で「施工中」に戻る。
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

  const states = orders.map((o) => (o.status === "CONFIRMED" ? orderProgress(o).state : null));
  const hasReturned = states.includes("RETURNED");
  const hasPending = states.includes("PENDING");

  // 直近（7日以内）の確定のお知らせ（受注者）
  const recentConfirm = !isOrderer
    ? orders
        .flatMap((o, i) =>
          o.progress
            .filter((p) => p.status === "CONFIRMED" && p.confirmedAt)
            .map((p) => ({ order: o, index: i, item: p }))
        )
        .filter(({ item }) => Date.now() - +new Date(item.confirmedAt!) < 7 * 24 * 60 * 60 * 1000)
        .sort((a, b) => +new Date(b.item.confirmedAt!) - +new Date(a.item.confirmedAt!))[0]
    : undefined;

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
        {/* 確定のお知らせ（受注者） */}
        {recentConfirm && (
          <div className="flex items-start gap-2 rounded-xl bg-[#DDF6E8] px-4 py-3 text-[13px] font-bold text-[#08724D]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
              <path d="M3 8.5L6.5 12L13 4.5" stroke="#08724D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              {recentConfirm.item.kind === "FINAL"
                ? `${orderLabel(recentConfirm.order, recentConfirm.index)} は全額が確定し、完了しました`
                : `${orderLabel(recentConfirm.order, recentConfirm.index)}の${progressLabel(recentConfirm.item.billingMonth)} ${yen(recentConfirm.item.amount)} が確定しました`}
            </span>
          </div>
        )}

        {data.parentName ? (
          <div className="flex flex-col gap-0.5">
            <p className="text-[13px] text-knock-text-secondary">現場名: {data.parentName}</p>
            <p className="text-[13px] font-semibold text-knock-text">
              工事名: {data.name ?? ""} / {isOrderer ? data.workerName : data.ordererName}
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-knock-text-secondary">
            {data.name ?? ""} / {isOrderer ? data.workerName : data.ordererName}
          </p>
        )}

        {!isOrderer && orders.some((o) => o.status === "CONFIRMED" && o.completionStatus !== "CLOSED") && (
          <p className="text-[13px] leading-relaxed text-knock-text-secondary">
            出来高は<span className="font-bold text-knock-text">発注書ごと</span>
            に報告します。報告したい発注書の「完了を報告する」を押してください。
          </p>
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
              const pre = preConfirmBadge(order);
              const confirmed = order.status === "CONFIRMED";
              const sum = orderProgress(order);
              const hasProgress = order.progress.length > 0;
              const latest = order.progress.at(-1);
              const pendingItem = order.progress.find((p) => p.status === "PENDING");
              const confirmedItems = order.progress.filter((p) => p.status === "CONFIRMED");
              // 旧フロー/差し戻し: 施工報告はあるが未完了（出来高を使っていない）
              const reportResend = confirmed && !hasProgress && order.hasReport && order.completionStatus !== "CLOSED";
              const completed = sum.state === "COMPLETED";

              return (
                <div
                  key={order.id}
                  className={`${cardClass} flex flex-col gap-3 border-l-4`}
                  style={{ borderLeftColor: accentColor }}
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
                    {pre ? (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${pre.color}`}>
                        {pre.label}
                      </span>
                    ) : reportResend ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                        施工報告 再送信待ち
                      </span>
                    ) : (
                      <ProgressChip state={sum.state} />
                    )}
                  </div>

                  <button
                    onClick={() => setExpandedId(expanded ? null : order.id)}
                    className="flex items-center justify-between text-left"
                  >
                    <span className="text-[12px] text-knock-text-secondary">
                      注文書金額
                      <TaxEx />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[18px] font-bold text-knock-text">{yen(sum.orderAmount)}</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                      >
                        <path d="M3.5 5L7 8.5L10.5 5" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>

                  {/* 出来高の進み具合（注文書が確定した発注書のみ） */}
                  {confirmed && order.orderSheet && (
                    <div className="rounded-xl bg-[#F7F7F8] p-3.5">
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="text-[13px] font-bold text-knock-text">
                          {completed ? (hasProgress ? "出来高（全額確定）" : "完了（全額）") : "出来高の進み具合"}
                        </p>
                        <span className="text-[10px] text-[#6B7080]">金額はすべて税抜</span>
                      </div>
                      <ProgressBar
                        orderAmount={sum.orderAmount}
                        confirmed={sum.confirmed}
                        pending={sum.pending}
                        color={accentColor}
                        segments={completed ? confirmedItems.map((p) => p.amount) : undefined}
                      />
                      <ProgressLegend
                        confirmed={sum.confirmed}
                        pending={sum.pending}
                        remaining={sum.remaining}
                        color={accentColor}
                        highlightPending
                      />
                    </div>
                  )}

                  {/* 出来高の履歴（確定済み・確定待ち） */}
                  {confirmed && hasProgress && (
                    <div className="flex flex-col">
                      <p className="mb-1 text-[12px] font-bold text-knock-text-secondary">
                        {completed ? "確定の内訳" : "出来高の履歴"}
                      </p>
                      {order.progress
                        .filter((p) => p.status !== "RETURNED")
                        .map((p) => (
                          <div key={p.id} className="flex items-center justify-between border-t border-gray-100 py-2">
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-knock-text">
                                {progressLabel(p.billingMonth)}
                                {p.kind === "FINAL" && <FinalTag />}
                              </p>
                              <p className="text-[11px] text-knock-text-secondary">
                                {p.status === "CONFIRMED"
                                  ? `申請 ${fmtDate(p.appliedAt)}・確定 ${fmtDate(p.confirmedAt!)}`
                                  : `申請 ${fmtDate(p.appliedAt)}・確定待ち`}
                              </p>
                            </div>
                            <span
                              className="shrink-0 text-[14px] font-bold"
                              style={{ color: p.status === "PENDING" ? "#7A4F00" : "#1E2235" }}
                            >
                              {yen(p.amount)}
                            </span>
                          </div>
                        ))}
                      {!completed && sum.remaining > 0 && (
                        <div className="flex items-center justify-between border-t border-gray-100 py-2">
                          <span className="text-[12px] text-knock-text-secondary">残り</span>
                          <span className="text-[13px] font-bold text-knock-text">{yen(sum.remaining)}</span>
                        </div>
                      )}
                      {completed && (
                        <div className="flex flex-col gap-1 border-t-2 border-[#1E2235] pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-bold text-knock-text">
                              合計
                              <TaxEx />
                            </span>
                            <span className="text-[17px] font-bold text-knock-text">{yen(sum.confirmed)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[12px] text-knock-text-secondary">
                            <span>消費税</span>
                            <span>{yen(confirmedItems.reduce((s, p) => s + progressTax(p.amount), 0))}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-bold text-knock-text">合計（税込）</span>
                            <span className="text-[14px] font-bold" style={{ color: accentColor }}>
                              {yen(confirmedItems.reduce((s, p) => s + p.amount + progressTax(p.amount), 0))}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 差し戻し（受注者・発注者とも表示） */}
                  {confirmed && sum.state === "RETURNED" && latest && (
                    <div className="rounded-xl border border-[#F2B8BB] bg-[#FDF2F2] p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-bold text-[#C8262E]">
                          {progressLabel(latest.billingMonth)}が差し戻されました
                        </p>
                        <span className="shrink-0 text-[13px] font-bold text-[#9AA0AC] line-through">
                          {yen(latest.amount)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-[#4A4F5C]">
                        {isOrderer
                          ? "この出来高は未確定に戻り、請求対象から外れています。受注者が修正して再送信します。"
                          : `${data.ordererName}が出来高を差し戻しました。この出来高は未確定に戻り、請求対象から外れています。金額や内容を修正して再送信してください。`}
                      </p>
                      {latest.returnedAt && (
                        <p className="mt-1.5 text-[11px] text-knock-text-secondary">
                          差し戻し {fmtDateTime(latest.returnedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* アクション */}
                  {!confirmed ? (
                    !isOrderer && order.status === "PENDING" && (
                      <button
                        onClick={() =>
                          router.push(
                            order.isAdditional ? `/orders/${order.id}/additional-review` : `/orders/${order.id}/accept`
                          )
                        }
                        className="w-full rounded-xl py-3 text-[14px] font-bold text-white transition-all active:scale-[0.98]"
                        style={{ backgroundColor: accentColor }}
                      >
                        {order.isAdditional ? "追加工事依頼に回答する" : "発注依頼に回答する"}
                      </button>
                    )
                  ) : isOrderer ? (
                    <>
                      {pendingItem && (
                        <button
                          onClick={() => router.push(`/orders/${order.id}/progress`)}
                          className="w-full rounded-xl py-3 text-[14px] font-bold text-white transition-all active:scale-[0.98]"
                          style={{ backgroundColor: accentColor }}
                        >
                          出来高 {yen(pendingItem.amount)} を確認して確定する
                        </button>
                      )}
                      {hasProgress && !pendingItem && (
                        <button
                          onClick={() => router.push(`/orders/${order.id}/progress`)}
                          className="w-full rounded-xl border-2 py-2.5 text-[13px] font-bold transition-all active:scale-[0.98]"
                          style={{ borderColor: accentColor, color: accentColor }}
                        >
                          出来高の履歴を見る
                        </button>
                      )}
                      {!hasProgress && order.hasReport && (
                        <button
                          onClick={() => router.push(`/orders/${order.id}/completion-report`)}
                          className="w-full rounded-xl border-2 py-2.5 text-[13px] font-bold transition-all active:scale-[0.98]"
                          style={{ borderColor: accentColor, color: accentColor }}
                        >
                          施工報告を確認
                        </button>
                      )}
                    </>
                  ) : completed ? (
                    <button
                      onClick={() =>
                        router.push(
                          hasProgress ? `/orders/${order.id}/progress` : `/orders/${order.id}/completion-report`
                        )
                      }
                      className="w-full rounded-xl border-2 py-2.5 text-[13px] font-bold transition-all active:scale-[0.98]"
                      style={{ borderColor: accentColor, color: accentColor }}
                    >
                      {hasProgress ? "出来高の履歴を見る" : "施工報告を確認"}
                    </button>
                  ) : sum.state === "PENDING" ? (
                    <div className="flex flex-col gap-1.5">
                      <button
                        disabled
                        className="w-full rounded-xl bg-[#E4E4E7] py-3 text-[14px] font-bold text-[#9AA0AC]"
                      >
                        完了を報告する
                      </button>
                      <p className="text-center text-[11px] text-knock-text-secondary">
                        確定前は取り消し・修正できません（差し戻しをお待ちください）
                      </p>
                    </div>
                  ) : sum.state === "RETURNED" ? (
                    <>
                      <button
                        onClick={() => router.push(`/orders/${order.id}/progress/report?resubmit=1`)}
                        className="w-full rounded-xl py-3 text-[14px] font-bold text-white transition-all active:scale-[0.98]"
                        style={{ backgroundColor: accentColor }}
                      >
                        出来高を修正して再送信する
                      </button>
                      <button
                        onClick={() => router.push(`/orders/${order.id}/progress`)}
                        className="w-full rounded-xl border-2 py-2.5 text-[13px] font-bold transition-all active:scale-[0.98]"
                        style={{ borderColor: accentColor, color: accentColor }}
                      >
                        差し戻された内容を確認
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() =>
                          router.push(
                            order.orderSheet
                              ? `/orders/${order.id}/progress/report`
                              : `/orders/${order.id}/completion-report`
                          )
                        }
                        className="flex w-full items-center justify-center gap-1 rounded-xl py-3 text-[14px] font-bold text-white transition-all active:scale-[0.98]"
                        style={{ backgroundColor: accentColor }}
                      >
                        {reportResend ? "施工報告を修正して再送信する" : "完了を報告する"}
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M6 3.5L10.5 8L6 12.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <p className="text-center text-[11px] text-knock-text-secondary">出来高は何回でも報告できます</p>
                    </div>
                  )}

                  {/* この工事(現場)の詳細へ。発注内容・注文書・完了状況は現場詳細でまとめて確認できる */}
                  <button
                    onClick={() => router.push(`/sites/${data.id}`)}
                    className="w-full rounded-xl border border-gray-300 py-2.5 text-[13px] font-bold text-knock-text transition-all active:scale-[0.98] active:bg-gray-50"
                  >
                    この工事の詳細を見る
                  </button>

                  {expanded && (
                    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
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
          (hasReturned ? (
            <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <p className="text-[15px] font-bold text-knock-text">差し戻された出来高があります</p>
              <p className="mt-1.5 text-[13px] text-knock-text-secondary">
                再送信して発注者が確定すると、その金額が請求対象になります。
              </p>
            </div>
          ) : hasPending ? (
            <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <p className="text-[15px] font-bold text-knock-text">
                {isOrderer ? "確定待ちの出来高があります" : "出来高の確定待ちです"}
              </p>
              <p className="mt-1.5 text-[13px] text-knock-text-secondary">
                {isOrderer
                  ? "内容を確認して確定すると、申請月の請求対象になります。誤りがあれば差し戻してください。"
                  : "発注者が確定すると、申請月の請求対象になります。"}
              </p>
            </div>
          ) : floorCompleted ? (
            <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <p className="text-[15px] font-bold text-knock-text">工事完了</p>
              {latestCompletedDay && (
                <p className="mt-1.5 text-[13px] text-knock-text-secondary">
                  工事完了日: {new Date(latestCompletedDay).toLocaleDateString("ja-JP")}
                </p>
              )}
              <p className="mt-2 text-[12px] text-knock-text-secondary">
                各発注書の注文書金額は完了した月、出来高は申請した月の請求対象になります。
                {isOrderer ? "追加工事を依頼すると、現場は施工中に戻ります。" : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <p className="text-[15px] font-bold text-knock-text">
                {isOrderer ? "受注者の完了報告待ち" : "完了報告が済んでいない発注書があります"}
              </p>
              <p className="mt-1.5 text-[13px] text-knock-text-secondary">
                {isOrderer
                  ? `受注者がすべての発注書の完了を報告し、出来高を確定すると工事完了になります（残り${remaining}件）。`
                  : `完了した発注書から順に請求対象になります。すべて完了すると工事完了です（残り${remaining}件）。`}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
