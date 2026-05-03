"use client";

import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";

const articles = [
  {
    title: "第1条（適用）",
    body: "本規約は、株式会社Knock（以下「当社」）が提供するサービス「Knock」（以下「本サービス」）の利用に関し、当社と利用者との間に適用されます。利用者は本規約に同意した上で本サービスをご利用ください。",
  },
  {
    title: "第2条（定義）",
    body: "本規約において使用する用語の定義は以下の通りです。「利用者」とは本サービスに登録した個人または法人を指します。「コンテンツ」とは利用者が本サービス上に投稿・掲載した情報全般を指します。",
  },
  {
    title: "第3条（利用登録）",
    body: "本サービスの利用を希望する方は、当社の定める方法により利用登録を行うものとします。当社は申請者が登録を不適切と判断した場合、登録を拒否することができます。登録情報は正確に入力してください。",
  },
  {
    title: "第4条（禁止事項）",
    body: "利用者は、法令または公序良俗に違反する行為、当社または第三者の権利を侵害する行為、本サービスの運営を妨害する行為、不正アクセスを試みる行為、その他当社が不適切と判断する行為を行ってはなりません。",
  },
  {
    title: "第5条（サービスの停止）",
    body: "当社は、システムのメンテナンス、障害対応、その他やむを得ない事由がある場合、事前の通知なく本サービスの全部または一部を停止することができます。これによる利用者の損害について当社は責任を負いません。",
  },
  {
    title: "第6条（免責事項）",
    body: "当社は、本サービスに関して利用者に生じた損害について、当社の故意または重過失による場合を除き、一切の責任を負いません。また、利用者間のトラブルについても当社は関与しないものとします。",
  },
  {
    title: "第7条（変更）",
    body: "当社は、必要と判断した場合には本規約を変更することができます。変更後の規約は、当社が別途定める場合を除き、本サービス上に掲示した時点から効力を生じるものとします。継続利用により変更に同意したとみなします。",
  },
];

export default function TermsPage() {
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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">利用規約</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        <div className="rounded-2xl bg-white px-5 py-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[12px] text-knock-text-muted mb-4">最終更新日: 2026年5月1日</p>
          <div className="flex flex-col gap-5">
            {articles.map((article) => (
              <div key={article.title}>
                <h2 className="text-[14px] font-bold text-knock-text mb-1.5">{article.title}</h2>
                <p className="text-[13px] leading-relaxed text-knock-text-secondary">{article.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
