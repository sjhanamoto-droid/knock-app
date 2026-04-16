"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getReceivedEvaluations } from "@/lib/actions/evaluations";
import { getTrustScore } from "@/lib/actions/trust-score-page";

type TrustScoreData = Awaited<ReturnType<typeof getTrustScore>>;
type EvalResult = Awaited<ReturnType<typeof getReceivedEvaluations>>;

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const percentage = (value / 5) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-[13px] text-knock-text">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right text-[13px] font-bold" style={{ color }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function TrustScorePage() {
  const router = useRouter();
  const { accentColor } = useMode();
  const [score, setScore] = useState<TrustScoreData | null>(null);
  const [evals, setEvals] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getTrustScore(),
      getReceivedEvaluations(1, 5),
    ])
      .then(([s, e]) => {
        setScore(s);
        setEvals(e);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">信用スコア</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none"><path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {/* スコアゲージ */}
        <div className="rounded-2xl bg-white p-6 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h2 className="mb-3 text-[14px] font-bold text-knock-text">信用スコア</h2>
          <div
            className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4"
            style={{ borderColor: accentColor }}
          >
            <div>
              <span className="text-[28px] font-bold" style={{ color: accentColor }}>
                {score ? Number(score.overallScore).toFixed(1) : "-.--"}
              </span>
              <span className="block text-[12px] text-knock-text-muted">/5.0</span>
            </div>
          </div>

          {/* 3軸バーチャート */}
          {score && (
            <div className="mt-4 flex flex-col gap-2">
              <ScoreBar label="技術力" value={Number(score.technicalAvg)} color={accentColor} />
              <ScoreBar label="コミュニケーション" value={Number(score.communicationAvg)} color={accentColor} />
              <ScoreBar label="信頼性" value={Number(score.reliabilityAvg)} color={accentColor} />
            </div>
          )}
        </div>

        {/* 取引実績 */}
        {score && (
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] border-l-4" style={{ borderLeftColor: accentColor }}>
            <h3 className="mb-3 text-[14px] font-bold text-knock-text">取引実績</h3>
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">完了取引</span>
                <span className="font-bold">{score.totalTransactions}件</span>
              </div>
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">取引総額</span>
                <span className="font-bold">
                  ¥{Number(score.totalAmount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">リピート率</span>
                <span className="font-bold">{Number(score.repeatRate).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">納期遵守率</span>
                <span className="font-bold">{Number(score.onTimeRate).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* 最近の評価コメント */}
        {evals && evals.evaluations.length > 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] border-l-4" style={{ borderLeftColor: accentColor }}>
            <h3 className="mb-3 text-[14px] font-bold text-knock-text">最近の評価</h3>
            <div className="flex flex-col gap-3">
              {evals.evaluations.map((ev) => (
                <div key={ev.id} className="border-b border-knock-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-knock-text">
                      {ev.evaluatorCompany.name}
                    </span>
                    <span className="flex items-center gap-0.5 text-[12px] text-amber-600">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" fill="#F59E0B" /></svg>
                      {((ev.technicalSkill + ev.communication + ev.reliability) / 3).toFixed(1)}
                    </span>
                  </div>
                  <span className="text-[11px] text-knock-text-muted">
                    {ev.factoryFloorOrder.factoryFloor.name}
                  </span>
                  {ev.comment && (
                    <p className="mt-1 text-[12px] text-knock-text-secondary">
                      {ev.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
