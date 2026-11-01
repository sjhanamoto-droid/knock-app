"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@knock/ui";
import { useMode } from "@/lib/hooks/use-mode";
import {
  getProgressContext,
  confirmProgressBilling,
  returnProgressBilling,
} from "@/lib/actions/progress-billing";
import { progressLabel, billingMonthLong, billingMonthNumber } from "@/lib/helpers/progress-billing";
import { ImageLightbox } from "@/components/image-lightbox";
import {
  TaxEx,
  yen,
  ProgressChip,
  ProgressBar,
  ProgressLegend,
  FinalTag,
  BillingMonthNote,
  ProgressHeader,
} from "@/components/progress-billing-ui";

type Ctx = NonNullable<Awaited<ReturnType<typeof getProgressContext>>>;

const cardClass = "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ja-JP");
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_LABEL = { PENDING: "確定待ち", CONFIRMED: "確定済", RETURNED: "差し戻し" } as const;

/**
 * 出来高の確定（発注者: GR08 → GR09 確定 / GR13 差し戻し）と、出来高の履歴（受注者・発注者）。
 */
export function ProgressReviewClient({ ctx }: { ctx: Ctx }) {
  const router = useRouter();
  const { toast } = useToast();
  const { accentColor } = useMode();
  const { summary } = ctx;
  const [dialog, setDialog] = useState<"confirm" | "return" | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);

  const pending = ctx.items.find((i) => i.status === "PENDING");
  const canDecide = ctx.isOrderer && !!pending;
  // 残り = 注文書金額 − 確定済み − 確定待ち ＝ 確定後の残り
  const afterRemaining = summary.remaining;

  async function run(kind: "confirm" | "return") {
    if (!pending || busy) return;
    setBusy(true);
    try {
      if (kind === "confirm") {
        const r = await confirmProgressBilling(pending.id);
        toast(
          r.completesOrder
            ? `${ctx.orderLabel}は全額が確定し、完了しました`
            : `${progressLabel(pending.billingMonth)} ${yen(pending.amount)} を確定しました`
        );
      } else {
        await returnProgressBilling(pending.id);
        toast("出来高を差し戻しました");
      }
      router.replace(`/work-completion/${ctx.floorId}`);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
      setBusy(false);
      setDialog(null);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F3F2EF]">
      <ProgressHeader
        title={canDecide ? "出来高の確定" : "出来高の履歴"}
        color={accentColor}
        onBack={() => router.back()}
      />

      <div className="flex flex-col gap-4 px-4 pt-3 pb-8">
        <div className="flex flex-col gap-0.5">
          {ctx.parentName && <p className="text-[13px] text-knock-text-secondary">現場名: {ctx.parentName}</p>}
          <p className="text-[13px] font-semibold text-knock-text">
            工事名: {ctx.floorName} / {ctx.isOrderer ? ctx.workerName : ctx.ordererName}
          </p>
        </div>

        {canDecide && (
          <div className={`${cardClass} flex items-start gap-3`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path
                d="M10 20a2 2 0 004 0M18 16V11a6 6 0 10-12 0v5l-2 2h16l-2-2z"
                stroke="#7A4F00"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-[14px] text-knock-text">
              {ctx.workerName}から<span className="font-bold">{pending!.kind === "FINAL" ? "残りすべて完了（最終）" : "一部完了（出来高）"}</span>
              の報告が届きました
            </p>
          </div>
        )}

        {/* 発注書カード */}
        <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[16px] font-bold text-knock-text">{ctx.orderLabel}</p>
              {ctx.documentNumber && <p className="text-[12px] text-knock-text-secondary">{ctx.documentNumber}</p>}
            </div>
            <ProgressChip state={summary.state} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[12px] text-knock-text-secondary">
              注文書金額
              <TaxEx />
            </span>
            <span className="text-[18px] font-bold text-knock-text">{yen(ctx.orderAmount)}</span>
          </div>
          <div className="mt-3 rounded-xl bg-[#F7F7F8] p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[13px] font-bold text-knock-text">出来高の進み具合</p>
              <span className="text-[10px] text-[#6B7080]">金額はすべて税抜</span>
            </div>
            <ProgressBar
              orderAmount={ctx.orderAmount}
              confirmed={summary.confirmed}
              pending={summary.pending}
              color={accentColor}
              segments={
                summary.state === "COMPLETED"
                  ? ctx.items.filter((i) => i.status === "CONFIRMED").map((i) => i.amount)
                  : undefined
              }
            />
            <ProgressLegend
              confirmed={summary.confirmed}
              pending={summary.pending}
              remaining={summary.remaining}
              color={accentColor}
              highlightPending
            />
          </div>

          {canDecide && pending && (
            <>
              <div className="mt-4 border-t border-gray-100 pt-4 text-center">
                <p className="text-[13px] font-bold text-knock-text-secondary">
                  確定する金額　{progressLabel(pending.billingMonth)}
                  {pending.kind === "FINAL" && <FinalTag />}
                </p>
                <p className="mt-1 text-[34px] font-bold" style={{ color: accentColor }}>
                  {yen(pending.amount)}
                  <TaxEx />
                </p>
                <p className="text-[13px] text-knock-text-secondary">申請日 {fmtDate(pending.appliedAt)}</p>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between text-knock-text-secondary">
                  <span>
                    注文書金額
                    <TaxEx />
                  </span>
                  <span>{yen(ctx.orderAmount)}</span>
                </div>
                <div className="flex justify-between text-knock-text-secondary">
                  <span>
                    確定済み
                    <TaxEx />
                  </span>
                  <span>{yen(summary.confirmed)}</span>
                </div>
                <div className="flex justify-between font-bold text-knock-text">
                  <span>
                    今回の出来高
                    <TaxEx />
                  </span>
                  <span>{yen(pending.amount)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#F3F3F5] px-4 py-3">
                  <span className="text-[14px] font-bold text-knock-text">
                    確定後の残り
                    <TaxEx />
                  </span>
                  <span className="text-[18px] font-bold text-knock-text">{yen(afterRemaining)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 出来高の内容・写真（確定待ち） */}
        {canDecide && pending && (pending.comment || pending.photos.length > 0) && (
          <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
            <p className="mb-1.5 text-[12px] font-bold text-knock-text-secondary">出来高の内容・写真</p>
            {pending.comment && <p className="whitespace-pre-wrap text-[14px] text-knock-text">{pending.comment}</p>}
            {pending.photos.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {pending.photos.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setViewer({ images: pending.photos, index: i })}
                    className="aspect-square overflow-hidden rounded-xl border border-gray-200"
                  >
                    <img src={url} alt={`施工写真 ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {canDecide && pending && (
          <>
            <BillingMonthNote billingMonth={pending.billingMonth} tone="orderer">
              確定すると {yen(pending.amount)}（税抜）が{billingMonthNumber(pending.billingMonth)}月の請求書に合算されます。
            </BillingMonthNote>
            <button
              onClick={() => setDialog("confirm")}
              disabled={busy}
              className="min-h-[52px] w-full rounded-xl text-[16px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              出来高 {yen(pending.amount)} を確定する
            </button>
            <button
              onClick={() => setDialog("return")}
              disabled={busy}
              className="min-h-[48px] w-full rounded-xl border border-[#F2B8BB] bg-[#FDF2F2] text-[15px] font-bold text-[#C8262E] transition-all active:scale-[0.98] disabled:opacity-50"
            >
              差し戻す
            </button>
            <p className="text-center text-[12px] text-knock-text-secondary">
              金額や内容に誤りがある場合は差し戻してください。受注者が修正して再送信します。
            </p>
          </>
        )}

        {/* 履歴（差し戻しも残す） */}
        <div className={cardClass}>
          <p className="mb-1 text-[13px] font-bold text-knock-text">出来高の履歴</p>
          {ctx.items.length === 0 ? (
            <p className="py-2 text-[13px] text-knock-text-secondary">まだ出来高の報告はありません。</p>
          ) : (
            [...ctx.items].reverse().map((it) => (
              <div key={it.id} className="border-t border-gray-100 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-knock-text">
                      {progressLabel(it.billingMonth)}
                      {it.kind === "FINAL" && <FinalTag />}
                    </p>
                    <p className="text-[11px] text-knock-text-secondary">
                      申請 {fmtDateTime(it.appliedAt)}
                      {it.confirmedAt && `・確定 ${fmtDateTime(it.confirmedAt)}`}
                      {it.returnedAt && `・差し戻し ${fmtDateTime(it.returnedAt)}`}
                    </p>
                    <p className="text-[11px] text-knock-text-secondary">請求月 {billingMonthLong(it.billingMonth)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-[14px] font-bold ${it.status === "RETURNED" ? "text-[#9AA0AC] line-through" : "text-knock-text"}`}
                    >
                      {yen(it.amount)}
                    </p>
                    <p
                      className="text-[11px] font-bold"
                      style={{
                        color:
                          it.status === "CONFIRMED" ? "#1E4FB0" : it.status === "PENDING" ? "#7A4F00" : "#C8262E",
                      }}
                    >
                      {STATUS_LABEL[it.status]}
                    </p>
                  </div>
                </div>
                {it.status !== "PENDING" && (it.comment || it.photos.length > 0) && (
                  <div className="mt-1.5 rounded-lg bg-[#F7F7F8] px-3 py-2">
                    {it.comment && <p className="whitespace-pre-wrap text-[12px] text-[#4A4F5C]">{it.comment}</p>}
                    {it.photos.length > 0 && (
                      <div className="mt-1.5 flex gap-1.5">
                        {it.photos.map((url, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setViewer({ images: it.photos, index: i })}
                            className="h-12 w-12 overflow-hidden rounded-lg"
                          >
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => router.push(`/work-completion/${ctx.floorId}`)}
          className="w-full rounded-xl border border-gray-300 bg-white py-3 text-[14px] font-bold text-knock-text"
        >
          工事完了画面へ
        </button>
      </div>

      {/* GR09 確定ダイアログ / GR13 差し戻しダイアログ */}
      {dialog && pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center">
          <div className="w-full max-w-[400px] rounded-2xl bg-white p-5" role="dialog" aria-modal="true">
            {dialog === "confirm" ? (
              <>
                <h3 className="text-center text-[18px] font-bold text-knock-text">出来高を確定しますか？</h3>
                <div className="mt-3 rounded-xl bg-[#F3F3F5] py-3 text-center">
                  <p className="text-[12px] text-knock-text-secondary">
                    {progressLabel(pending.billingMonth)}
                    {pending.kind === "FINAL" ? "（最終・完了）" : ""}
                  </p>
                  <p className="text-[26px] font-bold" style={{ color: accentColor }}>
                    {yen(pending.amount)}
                    <TaxEx />
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-1.5 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-knock-text-secondary">請求月</span>
                    <span className="font-bold text-knock-text">{billingMonthLong(pending.billingMonth)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-knock-text-secondary">
                      確定後の残り
                      <TaxEx />
                    </span>
                    <span className="font-bold text-knock-text">{yen(afterRemaining)}</span>
                  </div>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-knock-text-secondary">
                  確定後は金額・状態を変更できません。
                  {pending.kind === "FINAL" || afterRemaining === 0 ? "確定するとこの発注書は完了になります。" : ""}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-center text-[18px] font-bold text-knock-text">出来高の差し戻し</h3>
                <div className="mt-3 rounded-xl bg-[#FDF2F2] py-3 text-center">
                  <p className="text-[12px] text-knock-text-secondary">{progressLabel(pending.billingMonth)}</p>
                  <p className="text-[24px] font-bold text-[#C8262E]">
                    {yen(pending.amount)}
                    <TaxEx />
                  </p>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[#4A4F5C]">
                  出来高を差し戻しますか？この発注書の出来高は未確定に戻り、請求対象から外れます。受注者には修正・再送信の通知が届きます。
                </p>
              </>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setDialog(null)}
                disabled={busy}
                className="min-h-[48px] rounded-xl border border-gray-300 text-[14px] font-bold text-knock-text"
              >
                キャンセル
              </button>
              <button
                onClick={() => run(dialog)}
                disabled={busy}
                className="min-h-[48px] rounded-xl text-[14px] font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: dialog === "confirm" ? accentColor : "#C8262E" }}
              >
                {busy ? "処理中..." : dialog === "confirm" ? "確定する" : "差し戻す"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewer && (
        <ImageLightbox
          images={viewer.images}
          index={viewer.index}
          onClose={() => setViewer(null)}
          fileNamePrefix="施工写真"
        />
      )}
    </div>
  );
}
