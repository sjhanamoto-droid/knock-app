"use client";

import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";

const plans = [
  {
    id: "free",
    name: "フリー",
    price: 0,
    features: [
      "基本的な案件検索",
      "月5件までのメッセージ",
      "プロフィール公開",
    ],
    limits: [
      "マッチング上限あり",
      "帳票の自動生成なし",
    ],
  },
  {
    id: "standard",
    name: "スタンダード",
    price: 4980,
    popular: true,
    features: [
      "無制限メッセージ",
      "帳票の自動生成",
      "信用スコア表示",
      "空き日カレンダー公開",
      "優先マッチング",
    ],
    limits: [],
  },
  {
    id: "pro",
    name: "プロ",
    price: 9800,
    features: [
      "スタンダードの全機能",
      "案件の優先掲載",
      "詳細な分析レポート",
      "専任サポート",
      "API連携",
    ],
    limits: [],
  },
];

export default function PlanPage() {
  const router = useRouter();
  const { accentColor } = useMode();

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">プラン管理</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none"><path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        <p className="text-center text-[13px] text-knock-text-secondary">
          ビジネスに合ったプランをお選びください
        </p>

        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] ${plan.popular ? "ring-2" : ""}`}
            style={plan.popular ? { "--tw-ring-color": accentColor } as React.CSSProperties : undefined}
          >
            {plan.popular && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: accentColor }}
              >
                おすすめ
              </div>
            )}

            <h3 className="text-[16px] font-bold text-knock-text">{plan.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-[28px] font-bold" style={{ color: accentColor }}>
                ¥{plan.price.toLocaleString()}
              </span>
              <span className="text-[13px] text-knock-text-secondary">/月（税抜）</span>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {plan.features.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span className="text-[13px] text-knock-text">{f}</span>
                </div>
              ))}
              {plan.limits.map((l) => (
                <div key={l} className="flex items-start gap-2">
                  <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7H11" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  <span className="text-[13px] text-knock-text-muted">{l}</span>
                </div>
              ))}
            </div>

            <button
              className={`mt-4 w-full rounded-xl py-3 text-[14px] font-bold transition-all active:scale-[0.97] ${plan.popular ? "text-white" : "text-knock-text"}`}
              style={plan.popular ? { backgroundColor: accentColor } : { backgroundColor: "#F3F4F6" }}
            >
              {plan.price === 0 ? "現在のプラン" : "このプランを選択"}
            </button>
          </div>
        ))}

        <p className="text-center text-[11px] text-knock-text-muted">
          プラン変更は即時反映されます。日割り計算で精算します。
        </p>
      </div>
    </div>
  );
}
