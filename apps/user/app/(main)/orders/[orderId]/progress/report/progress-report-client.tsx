"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@knock/ui";
import { useMode } from "@/lib/hooks/use-mode";
import { getProgressContext, submitProgressBilling } from "@/lib/actions/progress-billing";
import { progressLabel, billingMonthLong, billingMonthNumber, nextMonthNumber } from "@/lib/helpers/progress-billing";
import { uploadPhotos } from "@/lib/upload-photos";
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
  StepIndicator,
} from "@/components/progress-billing-ui";

type Ctx = NonNullable<Awaited<ReturnType<typeof getProgressContext>>>;

/** 範囲の選択肢: all=すべて完了(施工報告へ) / final=残りすべて(出来高の最終) / partial=一部だけ(出来高) */
type Scope = "all" | "final" | "partial";
type Step = "scope" | "amount" | "confirm";

const cardClass = "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";

/**
 * 受注者: 完了の報告（GR02/GR12 範囲 → GR03 金額 → GR04 確認 → GR05 送信前アラート）。
 * 出来高を一度も確定していない発注書の「すべて完了」は従来の施工報告（送信で即完了）へ進む。
 */
export function ProgressReportClient({ ctx, resubmit }: { ctx: Ctx; resubmit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { accentColor } = useMode();
  const { summary } = ctx;

  // 2回目以降（確定済みあり）は「残りすべて」を初めから選択（GR12）
  const isSecond = summary.hasConfirmed;
  const returned = [...ctx.items].reverse().find((i) => i.status === "RETURNED");
  const resubmitting = resubmit && summary.state === "RETURNED" && !!returned;

  const [scope, setScope] = useState<Scope>(resubmitting ? "partial" : isSecond ? "final" : "all");
  const [step, setStep] = useState<Step>(resubmitting ? "amount" : "scope");
  const [amountText, setAmountText] = useState(
    resubmitting && returned && returned.amount <= summary.remaining ? returned.amount.toLocaleString() : ""
  );
  const [amountError, setAmountError] = useState("");
  const [comment, setComment] = useState(resubmitting ? (returned?.comment ?? "") : "");
  const [photos, setPhotos] = useState<string[]>(resubmitting ? (returned?.photos ?? []) : []);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);

  const billingMonth = ctx.nextBillingMonth;
  const month = billingMonthNumber(billingMonth);
  const remaining = summary.remaining;
  const amount = scope === "final" ? remaining : parseInt(amountText.replace(/,/g, ""), 10) || 0;
  const isFinal = scope === "final" || (amount > 0 && amount === remaining);
  const afterRemaining = Math.max(0, remaining - amount);
  const label = progressLabel(billingMonth);

  // 報告できない状態（確定待ち・完了・発注者・注文書なし）
  const blocked =
    ctx.isOrderer ||
    !ctx.orderConfirmed ||
    ctx.orderAmount <= 0 ||
    summary.state === "PENDING" ||
    summary.state === "COMPLETED";

  function back() {
    if (step === "confirm") setStep(scope === "final" ? "scope" : "amount");
    else if (step === "amount" && !resubmitting) setStep("scope");
    else router.back();
  }

  function onAmountChange(v: string) {
    const digits = v.replace(/[^0-9]/g, "").replace(/^0+/, "");
    setAmountText(digits ? Number(digits).toLocaleString() : "");
    setAmountError("");
  }

  function validateAmount(): boolean {
    if (!amountText || amount < 1) {
      setAmountError("金額を入力してください");
      return false;
    }
    if (amount > remaining) {
      setAmountError(`${yen(remaining)} 以内で入力してください`);
      return false;
    }
    return true;
  }

  function nextFromScope() {
    if (scope === "all") {
      // 出来高を使わない「すべて完了」は従来の施工報告（送信で即完了）
      router.push(`/orders/${ctx.orderId}/completion-report`);
      return;
    }
    setStep(scope === "final" ? "confirm" : "amount");
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await uploadPhotos(Array.from(files));
      setPhotos((prev) => [...prev, ...urls]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "写真のアップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitProgressBilling({
        orderId: ctx.orderId,
        amount,
        final: scope === "final",
        comment: comment || undefined,
        photos,
      });
      toast(`${label} ${yen(amount)} を送信しました`);
      router.replace(`/work-completion/${ctx.floorId}`);
      router.refresh();
    } catch (e) {
      // サーバーで残額が変わっていた等。確認画面に留まり金額を見直してもらう
      toast(e instanceof Error ? e.message : "エラーが発生しました");
      setSubmitting(false);
      setShowAlert(false);
    }
  }

  const title = step === "amount" ? "出来高の金額" : step === "confirm" ? "送信内容の確認" : "完了の報告";
  const totalSteps = isSecond && scope === "final" ? 2 : 3;
  const trail = totalSteps === 2 ? "範囲 → 確認" : "範囲 → 金額 → 確認";

  // 送信後のプレビュー（確定済み / 今回 / 残り）
  const previewBar = (
    <>
      <ProgressBar
        orderAmount={ctx.orderAmount}
        confirmed={summary.confirmed}
        pending={Math.min(amount, remaining)}
        color={accentColor}
      />
      <ProgressLegend
        confirmed={summary.confirmed}
        pending={Math.min(amount, remaining)}
        remaining={afterRemaining}
        color={accentColor}
        pendingLabel="今回（確定待ち）"
        highlightPending
      />
    </>
  );

  const breakdown = (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 text-[13px]">
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
        <span>{yen(amount)}</span>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-[#F3F3F5] px-4 py-3">
        <span className="text-[14px] font-bold text-knock-text">
          {isFinal ? "残り" : "残り（次回以降）"}
          <TaxEx />
        </span>
        <span className="text-[18px] font-bold text-knock-text">{yen(afterRemaining)}</span>
      </div>
    </div>
  );

  const contentInputs = (
    <>
      <div>
        <label className="mb-1.5 block text-[13px] font-bold text-knock-text">出来高の内容（任意）</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="例: 北面・東面の下塗り・中塗りまで完了しました。"
          className="w-full rounded-xl border border-[#E4E4E7] bg-[#F0F0F0] px-4 py-3 text-[14px]"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-bold text-knock-text">施工写真（任意）</label>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
        <div className="flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative h-20 w-20">
              <button
                type="button"
                onClick={() => setViewer({ images: photos, index: i })}
                className="block h-full w-full overflow-hidden rounded-xl"
              >
                <img src={url} alt={`施工写真 ${i + 1}`} className="h-full w-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                aria-label="写真を削除"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-[13px] text-gray-400"
          >
            {uploading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            ) : (
              "+ 追加"
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F3F2EF]">
      <ProgressHeader title={title} color={accentColor} onBack={back} />

      {blocked ? (
        <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
          <div className={cardClass}>
            <p className="text-[14px] font-bold text-knock-text">
              {summary.state === "PENDING"
                ? "確定待ちの出来高があります"
                : summary.state === "COMPLETED"
                  ? "この発注書は完了しています"
                  : "この発注書は報告できません"}
            </p>
            <p className="mt-1.5 text-[13px] text-knock-text-secondary">
              {summary.state === "PENDING"
                ? "確定前は取り消し・修正できません（差し戻しをお待ちください）"
                : "工事完了画面から状況を確認してください。"}
            </p>
          </div>
          <button
            onClick={() => router.replace(`/work-completion/${ctx.floorId}`)}
            className="w-full rounded-xl border border-gray-300 bg-white py-3 text-[14px] font-bold text-knock-text"
          >
            工事完了画面へ
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 pt-3 pb-8">
          {/* ===== GR02 / GR12: どこまで完了しましたか？ ===== */}
          {step === "scope" && (
            <>
              <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] text-knock-text-secondary">報告する発注書</p>
                    <p className="text-[16px] font-bold text-knock-text">{ctx.orderLabel}</p>
                    <p className="truncate text-[12px] text-knock-text-secondary">
                      {[ctx.documentNumber, ctx.floorName].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                  {isSecond ? (
                    <ProgressChip state={summary.state} />
                  ) : (
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] text-knock-text-secondary">
                        注文書金額
                        <TaxEx />
                      </p>
                      <p className="text-[17px] font-bold text-knock-text">{yen(ctx.orderAmount)}</p>
                    </div>
                  )}
                </div>
                {isSecond && (
                  <>
                    <div className="mt-3">
                      <ProgressBar
                        orderAmount={ctx.orderAmount}
                        confirmed={summary.confirmed}
                        pending={0}
                        color={accentColor}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-[#F3F3F5] py-2">
                        <p className="text-[11px] text-knock-text-secondary">注文書金額</p>
                        <p className="text-[14px] font-bold text-knock-text">{yen(ctx.orderAmount)}</p>
                      </div>
                      <div className="rounded-xl bg-[#F3F3F5] py-2">
                        <p className="text-[11px] text-knock-text-secondary">確定済み</p>
                        <p className="text-[14px] font-bold text-knock-text">{yen(summary.confirmed)}</p>
                      </div>
                      <div className="rounded-xl bg-[#FFF6EA] py-2">
                        <p className="text-[11px] text-knock-text-secondary">残り</p>
                        <p className="text-[14px] font-bold text-knock-text">{yen(remaining)}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-right text-[11px] text-[#6B7080]">金額はすべて税抜</p>
                  </>
                )}
              </div>

              <StepIndicator
                step={1}
                total={scope === "final" ? 2 : 3}
                label="完了の範囲"
                trail={scope === "final" ? "範囲 → 確認" : "範囲 → 金額 → 確認"}
                color={accentColor}
              />

              <h2 className="text-[20px] font-bold text-knock-text">どこまで完了しましたか？</h2>

              {/* すべて完了 / 残りすべて完了 */}
              <ScopeOption
                selected={scope === (isSecond ? "final" : "all")}
                onSelect={() => setScope(isSecond ? "final" : "all")}
                color={accentColor}
                icon="check"
                title={isSecond ? "残りすべて完了した" : "すべて完了した"}
                sub={
                  <span className="text-[#08724D]">
                    {yen(isSecond ? remaining : ctx.orderAmount)}
                    <TaxEx />
                    で完了
                  </span>
                }
              >
                {isSecond ? (
                  <>
                    <p className="text-[12px] font-bold text-knock-text">
                      {label}
                      <FinalTag />
                    </p>
                    <p className="mt-1">
                      金額の入力は不要です。発注者が確定すると{ctx.orderLabel}は完了になり、合計{" "}
                      {yen(ctx.orderAmount)}
                      <TaxEx />
                      になります。
                    </p>
                  </>
                ) : (
                  <p>この発注書は完了になり、全額が請求対象になります。</p>
                )}
              </ScopeOption>

              {/* 一部だけ（出来高） */}
              <ScopeOption
                selected={scope === "partial"}
                onSelect={() => setScope("partial")}
                color={accentColor}
                icon="pie"
                title={isSecond ? "まだ一部だけ" : "一部だけ完了した"}
                sub={<span style={{ color: "#B05E00" }}>出来高で報告</span>}
              >
                {isSecond ? (
                  <p>
                    今回終わった分の金額（{yen(remaining)} 以内）
                    <TaxEx />
                    を入力します。
                  </p>
                ) : (
                  <p>
                    終わった分の金額
                    <TaxEx />
                    だけを報告します。発注書は完了にならず、残りは後で報告できます。
                  </p>
                )}
              </ScopeOption>

              {!isSecond && (
                <p className="text-[13px] leading-relaxed text-knock-text-secondary">
                  出来高は何回でも報告できます。発注者が確定するまで請求対象にはなりません。
                </p>
              )}

              <PrimaryButton color={accentColor} onClick={nextFromScope}>
                次へ
              </PrimaryButton>
            </>
          )}

          {/* ===== GR03: 出来高の金額 ===== */}
          {step === "amount" && (
            <>
              <StepIndicator step={2} total={3} label="金額の入力" trail="範囲 → 金額 → 確認" color={accentColor} />

              <div className="flex items-center justify-between rounded-2xl border border-[#F3D9AE] bg-[#FFF6EA] px-4 py-3.5">
                <span className="text-[14px] font-bold text-knock-text">
                  {ctx.orderLabel}・{resubmitting ? "出来高の再送信" : "一部だけ完了（出来高）"}
                </span>
                {!resubmitting && (
                  <button
                    onClick={() => setStep("scope")}
                    className="text-[13px] font-bold underline"
                    style={{ color: "#B05E00" }}
                  >
                    変更
                  </button>
                )}
              </div>

              <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
                <label className="mb-2 block text-[14px] font-bold text-knock-text">
                  金額
                  <TaxEx />
                </label>
                <div
                  className="flex items-center gap-2 rounded-xl border-2 px-4 py-3"
                  style={{ borderColor: amountError ? "#C8262E" : accentColor }}
                >
                  <span className="text-[22px] font-bold text-knock-text">¥</span>
                  <input
                    value={amountText}
                    onChange={(e) => onAmountChange(e.target.value)}
                    onBlur={() => amountText && validateAmount()}
                    inputMode="numeric"
                    pattern="[0-9,]*"
                    placeholder="0"
                    aria-label="出来高の金額（税抜）"
                    className="min-w-0 flex-1 bg-transparent text-[28px] font-bold text-knock-text outline-none placeholder:text-gray-300"
                  />
                  <span className="text-[11px] text-[#6B7080]">税抜</span>
                </div>
                {amountError ? (
                  <p className="mt-1.5 text-[12px] font-bold text-[#C8262E]">{amountError}</p>
                ) : (
                  <p className="mt-1.5 text-[12px] text-knock-text-secondary">
                    1円〜{yen(remaining)}（残り）
                    <TaxEx />
                    まで入力できます
                  </p>
                )}

                <p className="mt-4 mb-2 text-[13px] font-bold text-knock-text">送信するとこうなります</p>
                {previewBar}
                <div className="mt-3">{breakdown}</div>
              </div>

              <BillingMonthNote billingMonth={billingMonth} tone="contractor" />

              {contentInputs}

              <PrimaryButton
                color={accentColor}
                onClick={() => {
                  if (validateAmount()) setStep("confirm");
                }}
              >
                確認へ
              </PrimaryButton>
            </>
          )}

          {/* ===== GR04: 送信内容の確認 ===== */}
          {step === "confirm" && (
            <>
              <StepIndicator
                step={totalSteps}
                total={totalSteps}
                label="確認"
                trail={trail}
                color={accentColor}
              />
              <div className="flex flex-col gap-0.5">
                {ctx.parentName && (
                  <p className="text-[13px] text-knock-text-secondary">現場名: {ctx.parentName}</p>
                )}
                <p className="text-[13px] text-knock-text-secondary">
                  工事名: {ctx.floorName} / {ctx.ordererName}
                </p>
              </div>

              <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[16px] font-bold text-knock-text">{ctx.orderLabel}</p>
                    {ctx.documentNumber && (
                      <p className="text-[12px] text-knock-text-secondary">{ctx.documentNumber}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-[#EEEFF2] px-2.5 py-1 text-[11px] font-bold text-[#4A4F5C]">
                    {isFinal ? "確定で完了" : "施工中のまま"}
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-knock-text-secondary">種類</span>
                    <span className="font-bold text-knock-text">
                      {label}
                      {isFinal ? <FinalTag /> : "（一部完了）"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-knock-text-secondary">申請日</span>
                    <span className="text-knock-text">{new Date().toLocaleDateString("ja-JP")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-knock-text-secondary">請求月</span>
                    <span className="font-bold text-knock-text">{billingMonthLong(billingMonth)}</span>
                  </div>
                </div>
                <div className="mt-3 border-t border-gray-100 pt-3 text-center">
                  <p className="text-[12px] font-bold text-knock-text-secondary">
                    今回の出来高
                    <TaxEx />
                  </p>
                  <p className="text-[34px] font-bold" style={{ color: accentColor }}>
                    {yen(amount)}
                  </p>
                </div>
                <div className="mt-2">{previewBar}</div>
                <div className="mt-3">{breakdown}</div>
                {scope !== "final" && (comment || photos.length > 0) && (
                  <div className="mt-3 text-[13px]">
                    {comment && (
                      <>
                        <p className="text-[12px] text-knock-text-secondary">出来高の内容</p>
                        <p className="whitespace-pre-wrap text-knock-text">{comment}</p>
                      </>
                    )}
                    {photos.length > 0 && (
                      <p className="mt-1 text-[12px] text-knock-text-secondary">施工写真 {photos.length}枚</p>
                    )}
                  </div>
                )}
              </div>

              {/* 最終（金額入力なし）は内容・写真をここで入力 */}
              {scope === "final" && contentInputs}

              <div className="rounded-2xl border border-[#F3D9AE] bg-[#FFF6EA] p-4">
                <p className="flex items-center gap-2 text-[14px] font-bold text-knock-text">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3L18 17H2L10 3Z" stroke="#7A4F00" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M10 8V12M10 14.5V15" stroke="#7A4F00" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  送信後は取り消し・修正できません
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6 text-[12px] leading-relaxed text-[#4A4F5C]">
                  <li>
                    発注者が確定すると、{yen(amount)}
                    <TaxEx />
                    が<span className="font-bold">{billingMonthLong(billingMonth)}の請求対象</span>になります
                  </li>
                  <li>
                    {month}月に申請した出来高は、確定が{nextMonthNumber(billingMonth)}月になっても{month}月分の請求になります
                  </li>
                  <li>間違いがあった場合は、発注者からの差し戻しを待って再送信します</li>
                  {isFinal ? (
                    <li>発注者が確定すると、この発注書は完了になります</li>
                  ) : (
                    <li>
                      発注書は完了になりません。残り {yen(afterRemaining)}
                      <TaxEx />
                      は次回報告します
                    </li>
                  )}
                </ul>
              </div>

              <PrimaryButton
                color={accentColor}
                onClick={() => {
                  setChecked(false);
                  setShowAlert(true);
                }}
                disabled={submitting}
              >
                出来高 {yen(amount)} を送信する
              </PrimaryButton>
              <button
                onClick={() => setStep(scope === "final" ? "scope" : "amount")}
                className="py-2 text-[14px] font-bold text-knock-text-secondary"
              >
                {scope === "final" ? "範囲を変更する" : "金額を修正する"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== GR05: 送信前の確認アラート ===== */}
      {showAlert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center">
          <div className="w-full max-w-[400px] rounded-2xl bg-white p-5" role="dialog" aria-modal="true">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#FDF1C7]">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                <path d="M10 3L18 17H2L10 3Z" stroke="#7A4F00" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M10 8V12M10 14.5V15" stroke="#7A4F00" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="text-center text-[18px] font-bold text-knock-text">本当に合っていますか？</h3>
            <div className="mt-3 rounded-xl bg-[#F3F3F5] py-3 text-center">
              <p className="text-[12px] text-knock-text-secondary">
                {label}
                {isFinal ? "（最終・完了）" : ""}
              </p>
              <p className="text-[24px] font-bold text-knock-text">
                {yen(amount)}
                <TaxEx />
              </p>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#4A4F5C]">
              送信後は取り消し・金額の修正ができません。間違いがあった場合は、発注者からの差し戻しを待って再送信してください。
            </p>
            <label className="mt-4 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-[#E4E4E7] px-3 py-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="h-5 w-5"
                style={{ accentColor }}
              />
              <span className="text-[14px] font-bold text-knock-text">金額と内容を確認しました</span>
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowAlert(false)}
                disabled={submitting}
                className="min-h-[48px] rounded-xl border border-gray-300 text-[14px] font-bold text-knock-text"
              >
                戻って見直す
              </button>
              <button
                onClick={handleSubmit}
                disabled={!checked || submitting}
                className="min-h-[48px] rounded-xl text-[14px] font-bold text-white disabled:opacity-40"
                style={{ backgroundColor: accentColor }}
              >
                {submitting ? "送信中..." : "送信する"}
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

function PrimaryButton({
  color,
  onClick,
  disabled,
  children,
}: {
  color: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[52px] w-full items-center justify-center gap-1 rounded-xl text-[16px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
      style={{ backgroundColor: color }}
    >
      {children}
    </button>
  );
}

function ScopeOption({
  selected,
  onSelect,
  color,
  icon,
  title,
  sub,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  color: string;
  icon: "check" | "pie";
  title: string;
  sub: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors"
      style={{
        borderColor: selected ? color : "#E4E4E7",
        backgroundColor: selected ? "#FFF6EA" : "#FFFFFF",
      }}
    >
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
        style={{ borderColor: selected ? color : "#9AA0AC" }}
      >
        {selected && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold text-knock-text">{title}</span>
        <span className="mt-0.5 block text-[15px] font-bold">{sub}</span>
        <span className="mt-1 block text-[13px] leading-relaxed text-[#4A4F5C]">{children}</span>
      </span>
      {icon === "check" ? (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="shrink-0">
          <circle cx="18" cy="18" r="16" fill="#DDF6E8" stroke="#08724D" strokeWidth="2" />
          <path d="M11 18.5L16 23.5L25 13" stroke="#08724D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="shrink-0">
          <circle cx="18" cy="18" r="16" fill="white" stroke={color} strokeWidth="2" />
          <path d="M18 2A16 16 0 0 1 28 30.5L18 18Z" fill={color} />
        </svg>
      )}
    </button>
  );
}
