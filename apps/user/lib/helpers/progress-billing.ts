/**
 * 出来高（発注書ごとの部分完了）の集計・表記ヘルパー。
 * サーバー(アクション/請求書生成)とクライアント(画面)の両方から使う純粋関数のみ置く。
 * "use server" を付けない通常モジュール。
 */

/** 請求書の明細キーで出来高を表す接頭辞（発注IDと区別する）: "pb:<出来高ID>" */
export const PROGRESS_KEY_PREFIX = "pb:";

export type ProgressKind = "PARTIAL" | "FINAL";
export type ProgressStatus = "PENDING" | "CONFIRMED" | "RETURNED";

/** 発注書の出来高の状態（チップ） */
export type ProgressOrderState = "IN_PROGRESS" | "PENDING" | "CONFIRMED" | "RETURNED" | "COMPLETED";

export interface ProgressItemLike {
  amount: number;
  status: ProgressStatus;
  kind: ProgressKind;
  appliedAt: string | Date;
}

export interface ProgressSummary {
  /** 注文書金額（税抜） */
  orderAmount: number;
  /** 確定済み = CONFIRMED の合計 */
  confirmed: number;
  /** 確定待ち = PENDING の金額 */
  pending: number;
  /** 残り = 注文書金額 − 確定済み − 確定待ち */
  remaining: number;
  state: ProgressOrderState;
  /** 出来高を一度でも確定したか（以降の「残りすべて」は出来高の最終として扱う） */
  hasConfirmed: boolean;
}

/**
 * 発注書の集計値と状態を出す。
 * - 差し戻し: 直前(最新)の出来高が差し戻されたまま、まだ再送信していない
 * - 完了: 最終(FINAL)の出来高が確定済み、または施工報告で完了(CLOSED)済み
 */
export function summarizeProgress(
  orderAmount: number,
  items: ProgressItemLike[],
  closed = false,
): ProgressSummary {
  let confirmed = 0;
  let pending = 0;
  for (const it of items) {
    if (it.status === "CONFIRMED") confirmed += it.amount;
    else if (it.status === "PENDING") pending += it.amount;
  }
  // 出来高を使わず施工報告で完了した発注書は、注文書金額の全額が確定済み
  if (closed && confirmed === 0 && pending === 0) confirmed = orderAmount;
  const remaining = Math.max(0, orderAmount - confirmed - pending);
  const latest = [...items].sort((a, b) => +new Date(b.appliedAt) - +new Date(a.appliedAt))[0];
  const finalConfirmed = items.some((it) => it.kind === "FINAL" && it.status === "CONFIRMED");

  let state: ProgressOrderState;
  if (closed || finalConfirmed) state = "COMPLETED";
  else if (pending > 0) state = "PENDING";
  else if (latest?.status === "RETURNED") state = "RETURNED";
  else if (confirmed > 0) state = "CONFIRMED";
  else state = "IN_PROGRESS";

  return { orderAmount, confirmed, pending, remaining, state, hasConfirmed: confirmed > 0 };
}

/** "202610" → "10月分" の月数字 */
export function billingMonthNumber(billingMonth: string): number {
  return parseInt(billingMonth.substring(4, 6), 10);
}

/** 表記「出来高[10月分]」 */
export function progressLabel(billingMonth: string): string {
  return `出来高[${billingMonthNumber(billingMonth)}月分]`;
}

/** "202610" → "2026年10月分" */
export function billingMonthLong(billingMonth: string): string {
  return `${billingMonth.substring(0, 4)}年${billingMonthNumber(billingMonth)}月分`;
}

/** 請求書PDF・明細の工事名表記「外壁塗装工事 出来高[10月分]」（最終は「最終・完了」を添える） */
export function progressLineName(siteName: string, billingMonth: string, kind: ProgressKind): string {
  return `${siteName} ${progressLabel(billingMonth)}${kind === "FINAL" ? "（最終・完了）" : ""}`;
}

/** 申請日時の JST 年月 "YYYYMM"（本番はUTC動作のため JST に寄せる） */
export function jstYearMonth(at: Date = new Date()): string {
  const jst = new Date(at.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 請求月の翌月の月数字（申請月の注記「確定が11月になっても10月分」用） */
export function nextMonthNumber(billingMonth: string): number {
  const m = billingMonthNumber(billingMonth);
  return m === 12 ? 1 : m + 1;
}

/** 消費税（10%・切り上げ）。注文書・請求書と同じ基準 */
export function progressTax(amount: number): number {
  return Math.ceil(amount * 0.1);
}
