/**
 * V2 通知タイプからルーティング先を決定
 */
export function getNotificationRoute(type: number, targetId: string | null): string | null {
  if (!targetId) return null;

  switch (type) {
    // V1: チャット関連
    case 1: return `/chat/${targetId}`;
    case 2: return `/chat/${targetId}`;
    // V1: 現場関連
    case 3: return `/floors/${targetId}`;
    case 4: return `/floors/${targetId}`;
    case 5: return `/floors/${targetId}`;
    // V2: つながり
    case 17: return `/invitations/${targetId}`;         // 連絡リクエスト → 招待詳細（承認/拒否）
    case 18: return `/chat/${targetId}`;              // つながり成立 → チャットルーム
    // V2: 受発注プロセス
    case 20: return `/orders/${targetId}/confirm`;     // 発注依頼
    case 21: return `/orders/${targetId}/accept`;      // 受注依頼
    case 22: return `/orders/${targetId}/completion-review`; // 完了報告
    case 23: return `/orders/${targetId}`;             // 評価通知
    case 24: return `/chat/${targetId}`;               // 注文書発行 → 現場ルームへ
    case 25: return `/orders/${targetId}/inspection`;  // 検収依頼
    case 26: return `/orders/${targetId}/delivery-approval`; // 納品承認依頼
    // V2: 発注辞退
    case 31: return `/sites/${targetId}`;                  // 発注辞退 → 現場詳細
    // V2: 追加工事
    case 32: return `/orders/${targetId}/additional-review`; // 追加工事依頼 → 承諾/辞退
    case 33: return `/orders/${targetId}/additional-review`; // 追加工事承諾 → 確定
    // V2: マッチング
    case 27: return `/jobs/${targetId}/applications`;   // 案件応募通知 → 応募一覧
    case 28: return `/jobs/${targetId}`;               // 応募結果通知 → 案件詳細
    // V2: 信用スコア・認証
    case 29: return `/mypage/trust-score`;             // スコア更新
    case 30: return `/documents/${targetId}`;          // 納品書発行 → 帳票確認へ
    // V2: 請求書
    case 40: return `/billing`;                    // 請求書ドラフト生成 → 請求書一覧
    case 41: return `/billing/${targetId}`;        // 請求書確定通知 → 請求書詳細
    case 42: return `/billing`;                    // 支払期日リマインド → 請求書一覧
    case 43: return `/billing/${targetId}`;        // 支払い完了通知 → 請求書詳細
    default: return null;
  }
}
