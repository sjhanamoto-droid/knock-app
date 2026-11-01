"use client";

import type { ProgressOrderState } from "@/lib/helpers/progress-billing";

/** 金額・項目名の後ろに小さく添える「（税抜）」 */
export function TaxEx({ bare = false }: { bare?: boolean }) {
  return (
    <span className="ml-0.5 text-[10px] font-normal text-[#6B7080]">{bare ? "税抜" : "（税抜）"}</span>
  );
}

export const yen = (n: number) => `¥${n.toLocaleString()}`;

/** 確定待ち（斜線）の背景。アクセント色＋白の斜線 */
export function stripe(color: string) {
  return `repeating-linear-gradient(135deg, ${color} 0 6px, ${color}66 6px 10px)`;
}

const CHIP: Record<ProgressOrderState, { label: string; className: string }> = {
  IN_PROGRESS: { label: "施工中", className: "bg-[#EEEFF2] text-[#4A4F5C]" },
  PENDING: { label: "出来高 確定待ち", className: "bg-[#FDF1C7] text-[#7A4F00]" },
  CONFIRMED: { label: "出来高 確定済", className: "bg-[#DCE8FD] text-[#1E4FB0]" },
  RETURNED: { label: "差し戻し", className: "bg-[#FDE7E8] text-[#C8262E]" },
  COMPLETED: { label: "完了", className: "bg-[#DDF6E8] text-[#08724D]" },
};

export function ProgressChip({ state }: { state: ProgressOrderState }) {
  const c = CHIP[state];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${c.className}`}>{c.label}</span>
  );
}

/** 「最終・完了」タグ */
export function FinalTag() {
  return (
    <span className="ml-1.5 inline-block rounded-md bg-[#DDF6E8] px-1.5 py-0.5 align-middle text-[10px] font-bold text-[#08724D]">
      最終・完了
    </span>
  );
}

/**
 * 3色の進捗バー（確定済み=塗り / 確定待ち=斜線 / 残り=グレー）。円表示のみ（％は出さない）。
 * segments を渡すと確定済みを区画（10月分/11月分など）ごとに区切って描く。
 */
export function ProgressBar({
  orderAmount,
  confirmed,
  pending,
  color,
  segments,
}: {
  orderAmount: number;
  confirmed: number;
  pending: number;
  color: string;
  segments?: number[];
}) {
  const pct = (n: number) => (orderAmount > 0 ? Math.min(100, (n / orderAmount) * 100) : 0);
  const parts = segments && segments.length > 1 ? segments : [confirmed];
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-md bg-[#ECECEF]">
      {parts.map((n, i) =>
        n > 0 ? (
          <div
            key={i}
            className={i > 0 ? "border-l-2 border-white" : ""}
            style={{ width: `${pct(n)}%`, backgroundColor: color }}
          />
        ) : null
      )}
      {pending > 0 && <div style={{ width: `${pct(pending)}%`, background: stripe(color) }} />}
    </div>
  );
}

/** バー下の凡例（確定済み／確定待ち／残り）。pendingLabel で「今回（確定待ち）」に切替 */
export function ProgressLegend({
  confirmed,
  pending,
  remaining,
  color,
  pendingLabel = "確定待ち",
  highlightPending = false,
}: {
  confirmed: number;
  pending: number;
  remaining: number;
  color: string;
  pendingLabel?: string;
  highlightPending?: boolean;
}) {
  return (
    <div className="mt-2.5 grid grid-cols-3 gap-2">
      <div>
        <p className="flex items-center gap-1.5 text-[11px] text-[#5B5F6B]">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
          確定済み
        </p>
        <p className="mt-0.5 text-[13px] font-bold text-[#1E2235]">{yen(confirmed)}</p>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-[11px] text-[#5B5F6B]">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: stripe(color) }} />
          {pendingLabel}
        </p>
        <p
          className="mt-0.5 text-[13px] font-bold"
          style={{ color: highlightPending && pending > 0 ? "#7A4F00" : "#1E2235" }}
        >
          {yen(pending)}
        </p>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-[11px] text-[#5B5F6B]">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-[#D4D6DC] bg-[#ECECEF]" />
          残り
        </p>
        <p className="mt-0.5 text-[13px] font-bold text-[#1E2235]">{yen(remaining)}</p>
      </div>
    </div>
  );
}

/** 申請月の注記（「10月に申請した出来高は、確定が11月になっても10月分の請求になります」） */
export function BillingMonthNote({
  billingMonth,
  tone,
  children,
}: {
  billingMonth: string;
  tone: "contractor" | "orderer";
  children?: React.ReactNode;
}) {
  const y = billingMonth.substring(0, 4);
  const m = parseInt(billingMonth.substring(4, 6), 10);
  const next = m === 12 ? 1 : m + 1;
  const cls =
    tone === "contractor" ? "border-[#F3D9AE] bg-[#FFF6EA]" : "border-[#C9DAF8] bg-[#EEF4FE]";
  const iconColor = tone === "contractor" ? "#B05E00" : "#2F6FE4";
  return (
    <div className={`flex gap-2.5 rounded-2xl border p-4 ${cls}`}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-0.5 shrink-0">
        <rect x="3" y="4.5" width="14" height="12.5" rx="2" stroke={iconColor} strokeWidth="1.6" />
        <path d="M3 8.5H17M7 2.5V6M13 2.5V6" stroke={iconColor} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-[#1E2235]">
          申請月 {y}年{m}月分
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[#4A4F5C]">
          {children}
          {m}月に申請した出来高は、確定が{next}月になっても{m}月分の請求になります
        </p>
      </div>
    </div>
  );
}

/** 出来高画面のヘッダー（戻る＋タイトル＋波線） */
export function ProgressHeader({ title, color, onBack }: { title: string; color: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          aria-label="戻る"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <h1 className="text-[17px] font-bold tracking-wide text-knock-text">{title}</h1>
          <svg width="60" height="6" viewBox="0 0 60 6" fill="none">
            <path
              d="M0 3 Q7.5 0 15 3 Q22.5 6 30 3 Q37.5 0 45 3 Q52.5 6 60 3"
              stroke={color}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="w-10" />
      </div>
    </header>
  );
}

/** ステップ表示（ステップ 2 / 3 金額の入力 ／ 範囲 → 金額 → 確認） */
export function StepIndicator({
  step,
  total,
  label,
  trail,
  color,
}: {
  step: number;
  total: number;
  label: string;
  trail: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-knock-text">
          ステップ {step} / {total}
          <span className="ml-3">{label}</span>
        </p>
        <span className="text-[12px] text-[#6B7080]">{trail}</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{ backgroundColor: i < step ? color : "#DCDCE0" }}
          />
        ))}
      </div>
    </div>
  );
}
