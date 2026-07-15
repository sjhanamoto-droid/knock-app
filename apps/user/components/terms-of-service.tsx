"use client";

import {
  TERMS_TITLE,
  TERMS_ISSUER,
  TERMS_EFFECTIVE,
  TERMS_CHAPTERS,
  TERMS_APPENDIX,
  type TermsArticle,
} from "@/lib/terms-content";

/* ──────────── 規約本文（スクロール領域の中身） ──────────── */

function ArticleView({ article }: { article: TermsArticle }) {
  return (
    <div>
      <h3 className="text-[14px] font-bold mb-2" style={{ color: "#1A2340" }}>
        {article.title}
      </h3>
      <div className="flex flex-col gap-1.5">
        {article.blocks.map((block, i) => (
          <p
            key={i}
            className="text-[13px] leading-[1.9]"
            style={{
              color: block.indent === 2 ? "#6B6B6B" : "#3A3A3A",
              paddingLeft: block.indent === 2 ? "1.75rem" : block.indent === 1 ? "1rem" : 0,
            }}
          >
            {block.text}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * 利用規約の本文のみ（ヘッダー・フッター・同意ボタン無し）。
 * 同意画面（TermsAgreementScreen）とサイドメニューの閲覧用ページ（/terms）で共用。
 */
export function TermsBody() {
  return (
    <div className="rounded-2xl bg-white px-5 py-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col gap-7">
        {TERMS_CHAPTERS.map((chapter) => (
          <section key={chapter.title} className="flex flex-col gap-4">
            <h2
              className="text-[15px] font-bold pb-2"
              style={{ color: "#1A2340", borderBottom: "2px solid #F5A623" }}
            >
              {chapter.title}
            </h2>
            {chapter.articles.map((article) => (
              <ArticleView key={article.title} article={article} />
            ))}
          </section>
        ))}

        {/* 附則 */}
        <section className="flex flex-col gap-2 pt-1">
          <ArticleView article={TERMS_APPENDIX} />
          <p className="text-[13px] font-semibold text-right" style={{ color: "#1A2340" }}>
            以上
          </p>
        </section>

        <p className="text-[12px] mt-1" style={{ color: "#9CA3AF" }}>
          {TERMS_ISSUER}　制定日：{TERMS_EFFECTIVE}
        </p>
      </div>
    </div>
  );
}

/* ──────────── 同意画面（ヘッダー＋スクロール＋固定フッター） ──────────── */

type TermsAgreementScreenProps = {
  /** 「利用規約に同意する」を押したとき */
  onAgree: () => void;
  /** 戻る（同意しない）ボタン。省略時は戻るボタンを表示しない */
  onBack?: () => void;
  /** 同意ボタンのラベル。省略時は「利用規約に同意する」 */
  agreeLabel?: string;
};

/**
 * 新規登録の最初に表示する利用規約同意画面。
 * - 規約全文はスクロール領域に表示
 * - 画面下部に「利用規約に同意する」ボタンを常時固定表示（最下部までスクロール不要で押せる）
 */
export function TermsAgreementScreen({
  onAgree,
  onBack,
  agreeLabel = "利用規約に同意する",
}: TermsAgreementScreenProps) {
  return (
    <div className="flex flex-col h-[100dvh] bg-[#F5F5F5]">
      {/* ヘッダー（固定） */}
      <header className="sticky top-0 z-40 shrink-0 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex w-full max-w-[560px] items-center justify-between px-4 py-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="戻る"
              className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <div className="w-10" />
          )}
          <h1 className="text-[17px] font-bold tracking-wide" style={{ color: "#1A2340" }}>
            利用規約
          </h1>
          <div className="w-10" />
        </div>
      </header>

      {/* 規約本文（スクロール領域） */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[560px] px-4 pt-4 pb-6">
          <p className="text-[18px] font-bold text-center mb-1" style={{ color: "#1A2340" }}>
            {TERMS_TITLE}
          </p>
          <p className="text-[12px] text-center mb-5" style={{ color: "#9CA3AF" }}>
            スクロールして内容をご確認ください
          </p>

          {/* 同意を促す案内 */}
          <div
            className="rounded-2xl px-5 py-4 mb-5"
            style={{ backgroundColor: "#FFF7EC", border: "1px solid #F5D9A8" }}
          >
            <p className="text-[13px] leading-relaxed" style={{ color: "#7A5A1E" }}>
              本サービスをご利用いただくには、以下の利用規約への同意が必要です。内容をご確認のうえ、ページ下部の「利用規約に同意する」ボタンを押してください。
            </p>
          </div>

          <TermsBody />
        </div>
      </div>

      {/* 同意ボタン（常時固定表示） */}
      <footer
        className="sticky bottom-0 z-40 shrink-0 bg-white"
        style={{
          borderTop: "1px solid #EDEDED",
          boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onAgree}
            className="w-full py-4 text-white font-bold text-[16px] transition-opacity active:opacity-80"
            style={{ backgroundColor: "#F5A623", borderRadius: "12px" }}
          >
            {agreeLabel}
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full py-2 text-[13px] active:opacity-70"
              style={{ color: "#6B6B6B" }}
            >
              同意しない（戻る）
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
