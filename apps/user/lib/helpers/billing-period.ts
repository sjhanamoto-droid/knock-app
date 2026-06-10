/**
 * 締め日(billingClosingDay)に基づく請求期間の計算ヘルパー。
 *
 * - 締め日は発注者(支払う側)ごとの設定。null = 月末締め。1〜28日を想定。
 * - すべてローカルタイムの new Date(y, m, d, ...) で構築する。
 *   DB に保存されている DELIVERY_NOTE.issuedAt との比較がローカルタイム基準のため、
 *   UTC/ISO 構築を混ぜると JST 分だけ境界がずれる。
 *
 * "use server" を付けない通常モジュール(action / service の両方から import するため)。
 */

/** 締め日を 1〜28 にクランプ(月末は null のまま扱う) */
function clampClosingDay(closingDay: number): number {
  return Math.min(28, Math.max(1, Math.trunc(closingDay)));
}

/**
 * 締め月(yearMonth = "YYYYMM")の請求期間 [start, end] を返す。
 * - 月末締め(closingDay == null): [当月1日 00:00:00, 当月末日 23:59:59.999]（従来挙動と一致）
 * - N日締め: [前月 N+1日 00:00:00, 当月 N日 23:59:59.999]
 */
export function getBillingPeriod(
  yearMonth: string,
  closingDay: number | null | undefined
): { start: Date; end: Date } {
  const year = parseInt(yearMonth.substring(0, 4), 10);
  const month = parseInt(yearMonth.substring(4, 6), 10); // 1-12

  if (closingDay == null) {
    return {
      start: new Date(year, month - 1, 1, 0, 0, 0, 0),
      end: new Date(year, month, 0, 23, 59, 59, 999),
    };
  }

  const n = clampClosingDay(closingDay);
  // month - 2 は 0 始まりの「前月」。1月(month=1)は -1 となり前年12月に繰り上がる。
  return {
    start: new Date(year, month - 2, n + 1, 0, 0, 0, 0),
    end: new Date(year, month - 1, n, 23, 59, 59, 999),
  };
}

/**
 * 納品日(issuedAt)がどの締め月(YYYYMM)に属するかを返す。getBillingPeriod の逆関数。
 * 複数発注者の納品書が混在する一覧で、各納品書をバケットするために使う。
 * - 月末締め: issuedAt のカレンダー月
 * - N日締め: 日 <= N → 当月、日 > N → 翌月
 */
export function getBillingMonth(
  issuedAt: Date,
  closingDay: number | null | undefined
): string {
  const y = issuedAt.getFullYear();
  const m = issuedAt.getMonth() + 1; // 1-12

  if (closingDay == null) {
    return `${y}${String(m).padStart(2, "0")}`;
  }

  const n = clampClosingDay(closingDay);
  if (issuedAt.getDate() <= n) {
    return `${y}${String(m).padStart(2, "0")}`;
  }
  // 翌月へ繰り上げ(12月→翌年1月も Date が処理)
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}`;
}
