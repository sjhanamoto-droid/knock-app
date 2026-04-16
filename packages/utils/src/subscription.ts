/**
 * サブスクリプション料金設定
 *
 * 現在はテスト期間のため全プラン無料。
 * 本番移行時に isTrial を false に切り替えると月額課金が有効になる。
 */

/** テスト期間フラグ — true の間は全プランが無料 */
export const IS_TRIAL_PERIOD = true;

export const PLANS = {
  CONTRACTOR: {
    label: "受注者プラン",
    monthlyPrice: 3300, // 税込 ¥3,300/月
    description: "案件の受注・現場管理・チャットなどの基本機能",
  },
  ORDERER: {
    label: "発注者プラン",
    monthlyPrice: 3300, // 税込 ¥3,300/月
    description: "協力会社の検索・発注・現場管理などの基本機能",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/**
 * 現在の実効価格を返す。テスト期間中は 0 を返す。
 */
export function getEffectivePrice(plan: PlanKey): number {
  if (IS_TRIAL_PERIOD) return 0;
  return PLANS[plan].monthlyPrice;
}

/**
 * 価格表示用テキスト
 */
export function formatPlanPrice(plan: PlanKey): string {
  if (IS_TRIAL_PERIOD) {
    return `¥0/月（通常 ¥${PLANS[plan].monthlyPrice.toLocaleString()}/月）`;
  }
  return `¥${PLANS[plan].monthlyPrice.toLocaleString()}/月（税込）`;
}

export const subscriptionStatusLabels: Record<string, string> = {
  TRIAL: "無料トライアル",
  ACTIVE: "有効",
  PAST_DUE: "支払い遅延",
  CANCELED: "解約済み",
  PAUSED: "一時停止",
};
