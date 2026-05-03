"use client";

import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";

const sections = [
  {
    title: "アカウント設定",
    description:
      "プロフィール情報の登録・編集方法、パスワード変更、通知設定など、アカウントに関する基本的な操作について説明します。初回ログイン後にまず確認してください。",
  },
  {
    title: "現場の作成・管理",
    description:
      "新しい現場（案件）の作成手順、現場情報の編集、ステータス管理の方法を解説します。親現場・子現場の階層構造による管理方法についても確認できます。",
  },
  {
    title: "案件の検索・応募",
    description:
      "条件を指定して案件を検索する方法、気になる案件への応募手順、応募状況の確認方法について説明します。フィルター機能を活用して効率よく案件を探しましょう。",
  },
  {
    title: "発注・受注の流れ",
    description:
      "発注者として案件を依頼する流れ、受注者として仕事を受ける流れを順を追って説明します。承認・却下・交渉など各ステータスの意味と対応方法も掲載しています。",
  },
  {
    title: "チャット機能",
    description:
      "現場ごとのチャットルームの使い方、メッセージの送受信、ファイル添付の方法について説明します。関係者全員とスムーズにコミュニケーションを取るための機能です。",
  },
  {
    title: "帳票の確認",
    description:
      "発行された注文書・請書などの帳票を確認・ダウンロードする方法を説明します。帳票の種類ごとの見方や、印刷・共有方法についても解説します。",
  },
  {
    title: "請求書管理",
    description:
      "請求書の作成・送付・受取・支払い処理の流れを説明します。締め日や支払期日の設定、請求書のステータス管理など、経理業務に役立つ機能を網羅しています。",
  },
];

export default function ManualPage() {
  const router = useRouter();
  const { accentColor } = useMode();

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">マニュアル</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-2xl bg-white px-5 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
          >
            <h2 className="text-[15px] font-bold text-knock-text mb-1.5">{section.title}</h2>
            <p className="text-[13px] leading-relaxed text-knock-text-secondary">{section.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
