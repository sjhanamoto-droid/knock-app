"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMode } from "@/lib/hooks/use-mode";
import { upgradeCompanyType } from "@/lib/actions/add-type";
import { PLANS, IS_TRIAL_PERIOD, formatPlanPrice } from "@knock/utils";

export default function AddTypePage() {
  const router = useRouter();
  const { update } = useSession();
  const { companyType, accentColor } = useMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const addingType = companyType === "CONTRACTOR" ? "発注者" : "受注者";
  const addingMode = companyType === "CONTRACTOR" ? "ORDERER" : "CONTRACTOR";
  const planKey = addingMode as "ORDERER" | "CONTRACTOR";
  const plan = PLANS[planKey];

  const handleUpgrade = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await upgradeCompanyType();
      if (result.success) {
        // まず companyType を BOTH に更新してから activeMode を切替
        await update({ companyType: "BOTH" });
        await update({ activeMode: addingMode });
        setDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col">
        <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="w-10" />
            <div className="flex flex-col items-center gap-0.5">
              <h1 className="text-[17px] font-bold tracking-wide text-knock-text">完了</h1>
              <svg width="40" height="6" viewBox="0 0 40 6" fill="none"><path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
            </div>
            <div className="w-10" />
          </div>
        </header>
        <div className="flex flex-col items-center gap-4 bg-[#F5F5F5] px-6 pt-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M8 16L14 22L24 10" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-knock-text">
            {addingType}機能が追加されました
          </h2>
          <p className="text-center text-[14px] text-knock-text-secondary">
            サイドメニューからモードを切り替えて利用できます。
          </p>
          <button
            onClick={() => {
              router.replace("/");
              router.refresh();
            }}
            className="mt-4 w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-colors active:opacity-80"
            style={{ backgroundColor: addingMode === "ORDERER" ? "#3B82F6" : "#E8960C" }}
          >
            {addingType}モードでホームへ
          </button>
          <button
            onClick={() => router.replace("/")}
            className="w-full rounded-xl bg-gray-100 py-3.5 text-[15px] font-medium text-knock-text transition-colors active:bg-gray-200"
          >
            現在のモードのままホームへ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
              {addingType}機能を追加
            </h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none"><path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-5 bg-[#F5F5F5] px-6 pt-6">
        {/* プラン説明 */}
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: addingMode === "ORDERER" ? "rgba(59,130,246,0.1)" : "rgba(232,150,12,0.1)" }}
            >
              {addingMode === "ORDERER" ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="#3B82F6" strokeWidth="1.8" />
                  <path d="M16.5 16.5L21 21" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="8" width="18" height="13" rx="2" stroke="#E8960C" strokeWidth="1.8" />
                  <path d="M8 8V6C8 4.343 9.343 3 11 3H13C14.657 3 16 4.343 16 6V8" stroke="#E8960C" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-knock-text">{plan.label}</h2>
              <p className="text-[13px] text-knock-text-secondary">{plan.description}</p>
            </div>
          </div>

          {/* 料金 */}
          <div className="rounded-xl bg-gray-50 px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-knock-text-secondary">月額料金</span>
              <div className="text-right">
                {IS_TRIAL_PERIOD ? (
                  <>
                    <span className="text-[20px] font-bold text-green-600">無料</span>
                    <p className="mt-0.5 text-[11px] text-knock-text-muted">
                      通常 ¥{plan.monthlyPrice.toLocaleString()}/月（税込）
                    </p>
                    <p className="text-[11px] text-knock-text-muted">
                      現在テスト期間のため無料でご利用いただけます
                    </p>
                  </>
                ) : (
                  <span className="text-[20px] font-bold text-knock-text">
                    {formatPlanPrice(planKey)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5 border-t border-gray-100 pt-4">
            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 8L7 11L12 5" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[13px] text-knock-text-secondary">
                現在の{companyType === "CONTRACTOR" ? "受注者" : "発注者"}アカウント情報はそのまま維持
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 8L7 11L12 5" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[13px] text-knock-text-secondary">
                サイドメニューからいつでもモードを切り替え可能
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 8L7 11L12 5" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[13px] text-knock-text-secondary">
                {addingMode === "ORDERER"
                  ? "協力会社の検索・発注・現場管理が利用可能"
                  : "案件の受注・チャット・現場報告が利用可能"}
              </span>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-[13px] text-red-600">
            {error}
          </p>
        )}

        {/* ボタン */}
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-colors active:opacity-80 disabled:opacity-60"
          style={{ backgroundColor: addingMode === "ORDERER" ? "#3B82F6" : "#E8960C" }}
        >
          {loading ? "処理中..." : `${addingType}機能を追加する`}
        </button>

        {!IS_TRIAL_PERIOD && (
          <p className="text-center text-[11px] text-knock-text-muted">
            追加後、月額 ¥{plan.monthlyPrice.toLocaleString()} が発生します。
            いつでも解約可能です。
          </p>
        )}
      </div>
    </div>
  );
}
