"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import OccupationSelector from "@/components/occupation-selector";
import {
  getOccupationMasters,
  saveCompanyOccupations,
} from "@/lib/actions/occupations";

type MajorItem = Awaited<ReturnType<typeof getOccupationMasters>>[number];
type Selection = { occupationSubItemId: string; note?: string };

const TOTAL_PAGES = 4;

export default function OnboardingPage() {
  const [page, setPage] = useState(1);
  const [masters, setMasters] = useState<MajorItem[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getOccupationMasters().then(setMasters);
  }, []);

  async function handleSaveOccupations() {
    setSaving(true);
    try {
      await saveCompanyOccupations(selections);
    } catch (err) {
      console.error("[Onboarding] save occupations error:", err);
    } finally {
      setSaving(false);
    }
  }

  const handleNext = async () => {
    if (page === 2 && selections.length > 0) {
      await handleSaveOccupations();
    }
    if (page < TOTAL_PAGES) {
      setPage(page + 1);
    } else {
      router.replace("/");
    }
  };

  const handleSkip = async () => {
    if (page === 2 && selections.length > 0) {
      await handleSaveOccupations();
    }
    router.replace("/");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <div className="px-5 pt-6 pb-8 flex flex-col flex-1">
        {/* Stepper progress indicator */}
        <div className="mb-8 flex items-center">
          {Array.from({ length: TOTAL_PAGES }, (_, i) => {
            const stepNum = i + 1;
            const isCompleted = stepNum < page;
            const isActive = stepNum === page;
            return (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                {/* Circle */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-300 ${
                    isCompleted || isActive
                      ? "bg-knock-orange text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                {/* Connector line (not after last step) */}
                {i < TOTAL_PAGES - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-1 transition-all duration-300 ${
                      stepNum < page ? "bg-knock-orange" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Page content */}
        <div className="flex-1 animate-[fadeSlideIn_0.35s_ease-out]" key={page}>
          {page === 1 && <Page1 />}
          {page === 2 && (
            <Page2Occupation
              masters={masters}
              selections={selections}
              onChange={setSelections}
            />
          )}
          {page === 3 && <Page3Features />}
          {page === 4 && <Page4ThankYou />}
        </div>

        {/* Buttons */}
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={handleNext}
            disabled={saving}
            className="w-full rounded-xl bg-knock-orange py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving
              ? "保存中..."
              : page === TOTAL_PAGES
                ? "はじめる"
                : "次へ"}
          </button>
          {page > 1 && (
            <button
              onClick={() => setPage(page - 1)}
              className="w-full rounded-xl border border-gray-300 py-3.5 text-[15px] font-bold text-knock-text"
            >
              戻る
            </button>
          )}
        </div>

        {page < TOTAL_PAGES && (
          <button
            onClick={handleSkip}
            className="mt-3 block w-full text-center text-[13px] text-knock-text-muted"
          >
            スキップしてはじめる
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page 1: 登録完了
// ---------------------------------------------------------------------------

function Page1() {
  return (
    <div className="text-center space-y-6">
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-knock-orange/10 animate-[ping_1.5s_ease-out_1]" />
        <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-knock-orange/5 to-knock-orange-light/10 blur-lg" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-knock-orange shadow-lg shadow-knock-orange/25">
          <span className="text-3xl font-bold leading-none text-white">
            &#10003;
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-[22px] font-bold text-knock-text">
          初期登録が完了しました
        </h2>
        <p className="text-[14px] text-knock-text-secondary leading-relaxed">
          アカウントの作成が完了しました。
          <br />
          続いて、対応する職種を設定しましょう。
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page 2: 職種選択
// ---------------------------------------------------------------------------

function Page2Occupation({
  masters,
  selections,
  onChange,
}: {
  masters: MajorItem[];
  selections: Selection[];
  onChange: (s: Selection[]) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-[22px] font-bold text-knock-text">対応職種の選択</h2>
        <p className="text-[14px] text-knock-text-secondary leading-relaxed">
          対応可能な職種を選択してください。
          <br />
          あとからマイページで変更できます。
        </p>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        <OccupationSelector
          masters={masters}
          value={selections}
          onChange={onChange}
        />
      </div>

      {selections.length > 0 && (
        <p className="text-center text-[12px] text-knock-text-secondary">
          {selections.length}件の職種を選択中
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page 3: サービス紹介
// ---------------------------------------------------------------------------

function Page3Features() {
  const features = [
    {
      title: "案件を探す・依頼する",
      description:
        "建設現場の案件を検索し、マッチングできます。発注者は案件を掲載し、受注者は条件に合った案件に応募できます。",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      ),
    },
    {
      title: "チャットでやりとり",
      description:
        "マッチング後はチャット機能で直接やりとりができます。案件の詳細確認や契約条件の調整もスムーズに。",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      title: "契約・請求を管理",
      description:
        "契約書の作成から請求書の発行まで、一つのプラットフォームで完結できます。",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-[22px] font-bold text-knock-text">
          Knockでできること
        </h2>
        <p className="text-[14px] text-knock-text-secondary leading-relaxed">
          建設業界のマッチングを、もっとシンプルに。
        </p>
      </div>

      <div className="space-y-4">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex gap-4 rounded-2xl bg-[#F5F5F5] p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-knock-orange/10 text-knock-orange">
              {feature.icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-knock-text">
                {feature.title}
              </h3>
              <p className="mt-1 text-xs text-knock-text-secondary leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page 4: サンキューページ
// ---------------------------------------------------------------------------

function Page4ThankYou() {
  return (
    <div className="text-center space-y-6">
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
        <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-knock-orange/5 to-knock-orange-light/10 blur-md" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-knock-orange/10">
          <svg
            className="w-8 h-8 text-knock-orange"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-[22px] font-bold text-knock-text">
          準備が整いました
        </h2>
        <p className="text-[14px] text-knock-text-secondary leading-relaxed">
          それでは、Knockをはじめましょう。
          <br />
          まずはホーム画面から案件を確認してみてください。
        </p>
      </div>

      <div className="inline-flex items-center gap-2 rounded-lg bg-knock-bg px-4 py-3 text-sm text-knock-text-secondary">
        <svg className="w-4 h-4 text-knock-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        プロフィールはマイページからいつでも編集できます
      </div>
    </div>
  );
}
