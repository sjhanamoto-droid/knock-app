import {
  CONTRACT_TITLE,
  YAKKAN_TITLE,
  AGREEMENT_PREAMBLE,
  AGREEMENT_BODY,
  AGREEMENT_ATTESTATION,
  YAKKAN_ARTICLES,
  type ContractArticle,
} from "@/lib/contract-content";

/* ──────────── 条文レンダリング ──────────── */

function ArticleView({ article }: { article: ContractArticle }) {
  return (
    <div>
      <h3 className="text-[13.5px] font-bold mb-1.5" style={{ color: "#1A2340" }}>
        {article.title}
      </h3>
      <div className="flex flex-col gap-1">
        {article.blocks.map((block, i) => (
          <p
            key={i}
            className="text-[12.5px] leading-[1.95]"
            style={{
              color: "#333",
              paddingLeft: block.indent === 1 ? "1.1rem" : 0,
            }}
          >
            {block.text}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ──────────── 当事者欄 ──────────── */

function PartyLine({ role, name }: { role: string; name: string }) {
  return (
    <div className="flex items-end gap-3">
      <span className="shrink-0 text-[13px] font-bold" style={{ color: "#1A2340" }}>
        {role}
      </span>
      <span
        className="min-w-0 flex-1 text-[14px] font-semibold pb-0.5"
        style={{ color: "#1A1A1A", borderBottom: "1px solid #C9C9C9" }}
      >
        {name || " "}
      </span>
    </div>
  );
}

function formatDateJP(d: Date): string {
  const date = new Date(d);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/* ──────────── メイン ──────────── */

/**
 * 工事下請基本契約書ビュー（閲覧用）。
 * @param ordererName    発注者＝元請負人の会社名
 * @param contractorName 受注者＝下請負人の会社名
 * @param matchedAt      契約日（＝交渉ルーム作成日／マッチング日）
 */
export function SubcontractAgreementView({
  ordererName,
  contractorName,
  matchedAt,
}: {
  ordererName: string;
  contractorName: string;
  /** 契約日。未指定（公示テンプレ）のときは空欄表示 */
  matchedAt?: Date | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* ── 契約書（第1面） ── */}
      <div className="rounded-2xl bg-white px-5 py-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <h2 className="text-[19px] font-bold text-center mb-6" style={{ color: "#1A2340" }}>
          {CONTRACT_TITLE}
        </h2>

        {/* 当事者 */}
        <div className="flex flex-col gap-3 mb-5">
          <PartyLine role="元請負人" name={ordererName} />
          <PartyLine role="下請負人" name={contractorName} />
        </div>

        {/* 前文 */}
        <p className="text-[12.5px] leading-[1.95] mb-5" style={{ color: "#333" }}>
          {AGREEMENT_PREAMBLE}
        </p>

        {/* 第1〜3条 */}
        <div className="flex flex-col gap-4">
          {AGREEMENT_BODY.map((article) => (
            <ArticleView key={article.title} article={article} />
          ))}
        </div>

        {/* 締結文 */}
        <p className="text-[12.5px] leading-[1.95] mt-5" style={{ color: "#333" }}>
          {AGREEMENT_ATTESTATION}
        </p>

        {/* 契約日（マッチング日／公示テンプレは空欄） */}
        <p className="text-[13.5px] font-semibold mt-6 mb-5 pl-2" style={{ color: "#1A1A1A" }}>
          {matchedAt ? formatDateJP(matchedAt) : "　　　　年　　　月　　　日"}
        </p>

        {/* 署名欄（住所・押印なし、氏名＝会社名） */}
        <div className="flex flex-col gap-4">
          {[
            { role: "元請負人", name: ordererName },
            { role: "下請負人", name: contractorName },
          ].map((p) => (
            <div key={p.role} className="flex items-end gap-3">
              <span className="shrink-0 text-[13px] font-bold w-16" style={{ color: "#1A2340" }}>
                {p.role}
              </span>
              <span className="shrink-0 text-[12.5px]" style={{ color: "#6B6B6B" }}>氏名</span>
              <span
                className="min-w-0 flex-1 text-[14px] font-semibold pb-0.5"
                style={{ color: "#1A1A1A", borderBottom: "1px solid #C9C9C9" }}
              >
                {p.name || " "}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 約款 ── */}
      <div className="rounded-2xl bg-white px-5 py-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <h2
          className="text-[16px] font-bold text-center tracking-[0.2em] pb-3 mb-5"
          style={{ color: "#1A2340", borderBottom: "2px solid #E8960C" }}
        >
          {YAKKAN_TITLE}
        </h2>
        <div className="flex flex-col gap-5">
          {YAKKAN_ARTICLES.map((article) => (
            <ArticleView key={article.title} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
}
