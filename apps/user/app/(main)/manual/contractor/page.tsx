"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";

type Action = { label: string; kind: "primary" | "outline" | "ghost" };
type Img = { src: string; cap?: string };
type Step = { title: string; desc?: string; points: string[]; images: Img[]; actions?: Action[] };
type Section = {
  num: number;
  chip: string;
  title: string;
  when: string;
  points?: string[];
  actions?: Action[];
  images?: Img[];
  note?: string;
  next: string;
  sub?: { title: string; desc: string; points: string[]; images: Img[] };
  steps?: Step[];
};

const IMG = (f: string) => `/manual-images/${f}`;

const sections: Section[] = [
  {
    num: 1,
    chip: "連絡リクエスト",
    title: "つながり申請がきたら",
    when:
      "発注者とやり取り（発注の受領）をするには、まず「つながり」を結ぶ必要があります。発注者から連絡リクエストが届くと通知が来ます。通知をタップすると下の画面が開きます。",
    points: [
      "「以下の企業から連絡リクエストが届いています。承認するとチャットが開始されます。」",
      "申請元の企業カード（会社名・種別・住所、「詳細を見る」で会社情報を確認）",
    ],
    actions: [
      { label: "承認する", kind: "primary" },
      { label: "拒否する", kind: "ghost" },
    ],
    images: [{ src: IMG("01-connection.png"), cap: "連絡リクエスト画面" }],
    note: "「承認する」を押すと確認（○○ とのつながりを承認します。チャットルームが作成されます。）→ つながりが成立し、チャットが始まります。",
    next: "承認すると、その発注者から発注を受けられるようになります。",
  },
  {
    num: 2,
    chip: "発注依頼",
    title: "発注依頼が来たら",
    when:
      "つながっている発注者から発注依頼が届くと通知が来ます。通知をタップすると下の画面（発注依頼）が開きます。",
    points: [
      "発注元（会社名）／現場名／工期",
      "発注金額：小計・消費税（10%）・合計金額（税込）",
      "「現場の詳細を確認する」で住所・図面などを確認",
    ],
    actions: [
      { label: "受注する", kind: "primary" },
      { label: "条件を相談する（チャット）", kind: "outline" },
      { label: "辞退する", kind: "ghost" },
    ],
    images: [{ src: IMG("02-order-request.png"), cap: "発注依頼画面" }],
    sub: {
      title: "初回だけ：口座情報の登録",
      desc:
        "はじめて「受注する」を押したときは「受注に必要な情報の登録」が表示されます（インボイス番号は適格請求書に、振込先口座は請求・支払いに使用）。",
      points: [
        "入力項目：インボイス番号（先頭Tを除く13桁）／銀行名／支店名／口座種別（普通・当座）／口座番号／口座名義",
        "入力して「保存して受注する」→ 確認画面で「保存して受注する」で確定",
        "2回目以降はこの登録は不要で、すぐに受注できます",
      ],
      images: [{ src: IMG("02b-bank-register.png"), cap: "口座情報の登録（初回のみ）" }],
    },
    next: "受注後、発注者が内容を確定すると注文書が発行されます（次の項目）。",
  },
  {
    num: 3,
    chip: "注文書",
    title: "発注が確定したら（注文書の確認）",
    when:
      "あなたが受注した後、発注者が内容を確定すると注文書が発行され通知が届きます。帳票一覧（メニューの「帳票」／「注文書」）から該当の注文書をタップすると下の画面が開きます。",
    points: [
      "注文書番号（No. ORD-…）／発行日",
      "発注者・受注者（自社・インボイス番号も表示）",
      "金額：品目ごとの明細（数量 × 単価）、小計、消費税（10%）、合計",
      "現場名／「PDFをダウンロード」で保存・印刷",
    ],
    actions: [{ label: "PDFをダウンロード", kind: "primary" }],
    images: [{ src: IMG("03-order-sheet.png"), cap: "注文書（帳票詳細）" }],
    next: "これが正式な発注の証憑（しょうひょう）です。内容を確認して施工を進めてください。",
  },
  {
    num: 4,
    chip: "追加工事の確認",
    title: "追加工事依頼が来たら",
    when:
      "施工中に、発注者から追加工事の依頼が届くことがあります。通知をタップすると下の画面（追加工事の確認）が開きます。",
    points: [
      "ステータス「承諾待ち」／現場名・発注者・受注者",
      "追加工事 明細：品目（数量 @ 単価／仕様）、小計、消費税（10%）、合計金額（税込）",
      "初回の発注とは別の依頼として届きます。金額・明細は追加工事の内容です",
    ],
    actions: [
      { label: "承諾する", kind: "primary" },
      { label: "辞退する", kind: "ghost" },
    ],
    images: [{ src: IMG("04-additional.png"), cap: "追加工事の確認画面" }],
    note: "「承諾する」を押すと確認（この追加工事を承諾しますか？）。辞退しても本工事や他の追加工事には影響しません。",
    next: "承諾後、発注者が確定すると追加分の注文書が発行されます。本工事とは別の発注書として管理されます。",
  },
  {
    num: 5,
    chip: "施工報告 → 工事完了",
    title: "施工が完了したら（工事完了）",
    when: "施工が終わったら、「施工報告」→「工事を締める」の2ステップで完了させます。",
    steps: [
      {
        title: "ステップ1：施工報告を送る（発注書ごと）",
        desc: "各発注書について施工報告を送ります。通知、または工事完了画面の発注書から開きます。",
        points: [
          "施工完了日（必須）",
          "施工報告コメント（任意）",
          "施工写真（任意・「+ 追加」から複数添付可）",
          "「施工報告を送信」（報告済みの場合は「施工報告を更新」）で送信",
        ],
        images: [{ src: IMG("05-completion-report.png"), cap: "施工報告画面" }],
      },
      {
        title: "ステップ2：工事を締める",
        desc: "すべての発注書の施工報告が済むと、工事完了画面で「工事を締める」が押せるようになります。",
        points: [
          "発注書の一覧（本工事「発注書 1」・追加工事）。各カードに「施工報告 済／未」と金額を表示",
          "各発注書のカードをタップすると、その依頼の明細（証左）を展開して確認できます",
          "すべて施工報告済みになったら「工事を締める」→ 確認（全ての工事を締めますか？発注者に工事完了の確認を依頼します。）",
        ],
        actions: [{ label: "工事を締める", kind: "primary" }],
        images: [{ src: IMG("06-work-completion.png"), cap: "工事完了画面" }],
      },
    ],
    next:
      "締めると発注者に工事完了の確認が依頼されます。発注者が承認すると工事完了となり、その後請求書の発行に進みます。締めた後は「発注者の確認待ち」と表示されます。",
  },
];

function ManualImage({ img }: { img: Img }) {
  return (
    <figure className="m-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.src}
        alt={img.cap ?? ""}
        loading="lazy"
        className="w-full rounded-xl border border-[#ECECEC] shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
      />
      {img.cap && <figcaption className="mt-1.5 text-center text-[11px] text-knock-text-secondary">{img.cap}</figcaption>}
    </figure>
  );
}

export default function ContractorManualPage() {
  const router = useRouter();
  const { accentColor } = useMode();

  const btnStyle = (kind: Action["kind"]) => {
    if (kind === "primary") return { backgroundColor: accentColor, color: "#fff" };
    if (kind === "outline") return { backgroundColor: "#fff", color: accentColor, border: `2px solid ${accentColor}` };
    return { backgroundColor: "#fff", color: "#6B7280", border: "1px solid #D9DCE1" };
  };

  const Points = ({ items }: { items: string[] }) => (
    <ul className="mb-4 flex flex-col">
      {items.map((p, i) => (
        <li key={i} className="relative border-b border-dashed border-[#ECECEC] py-2 pl-5 text-[13px] leading-relaxed last:border-b-0">
          <span className="absolute left-0 top-[14px] h-[6px] w-[6px] rounded-full" style={{ backgroundColor: accentColor }} />
          {p}
        </li>
      ))}
    </ul>
  );

  const Actions = ({ items }: { items: Action[] }) => (
    <div className="mb-3 flex flex-wrap gap-2">
      {items.map((a, i) => (
        <span key={i} className="rounded-[10px] px-4 py-2 text-[12px] font-bold" style={btnStyle(a.kind)}>
          {a.label}
        </span>
      ))}
    </div>
  );

  const NextBox = ({ text }: { text: string }) => (
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#CFEBD9] bg-[#EAF7EF] px-4 py-3">
      <span className="mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#34A56C] text-[13px] font-extrabold text-white">✓</span>
      <p className="text-[13px] leading-relaxed text-[#226A43]">{text}</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">受注者マニュアル</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-4 pb-10">
        {/* イントロ */}
        <div className="rounded-2xl bg-white px-5 py-4 text-[13px] leading-relaxed text-knock-text-secondary shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          各操作は基本的に<span className="font-bold text-knock-text">画面右上のベルの通知</span>から始まります。通知をタップすると該当の画面に移動します。アクションごとに操作の流れを解説します。
        </div>

        {/* はじめに：通知の確認方法 */}
        <section className="rounded-2xl bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="mb-2 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#34A56C] text-[18px] font-extrabold text-white">★</span>
            <div>
              <span className="inline-block rounded-full bg-[#FDF2E3] px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: accentColor }}>はじめに</span>
              <h2 className="mt-0.5 text-[18px] font-bold text-knock-text">通知の確認方法</h2>
            </div>
          </div>
          <p className="mb-4 text-[13px] text-knock-text-secondary">対応が必要なことは通知で届きます。確認方法は次の2つです。</p>

          <h3 className="mb-2 text-[14px] font-bold text-knock-text">① 画面右上のベル</h3>
          <Points items={["ベルをタップすると通知一覧が開きます（新着があると赤いバッジで件数を表示）", "各通知をタップすると、対応する画面（発注依頼・追加工事・工事完了など）に移動します"]} />
          <div className="mb-5 flex flex-col gap-3">
            <ManualImage img={{ src: IMG("00a-bell.png"), cap: "画面右上のベル（赤バッジ＝新着件数）" }} />
            <ManualImage img={{ src: IMG("00b-notifications.png"), cap: "ベルをタップ → 通知一覧" }} />
          </div>

          <h3 className="mb-2 text-[14px] font-bold text-knock-text">② ホームのカードのボタン</h3>
          <Points items={["「今日の現場」の各カードに、その時に必要な操作ボタン（例：発注依頼に回答／追加工事依頼に回答／工事完了 など）が表示されます", "ボタンをタップすると、そのまま操作画面へ進めます"]} />
          <ManualImage img={{ src: IMG("00a-home.png"), cap: "ホーム「今日の現場」のカード" }} />
        </section>

        {/* 各アクション */}
        {sections.map((s) => (
          <section key={s.num} className="rounded-2xl bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <div className="mb-2 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px] font-extrabold text-white" style={{ backgroundColor: accentColor }}>
                {s.num}
              </span>
              <div>
                <span className="inline-block rounded-full bg-[#FDF2E3] px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: accentColor }}>{s.chip}</span>
                <h2 className="mt-0.5 text-[18px] font-bold text-knock-text">{s.title}</h2>
              </div>
            </div>
            <p className="mb-4 text-[13px] leading-relaxed text-knock-text-secondary">{s.when}</p>

            {s.steps ? (
              s.steps.map((st, i) => (
                <div key={i} className={i > 0 ? "mt-5 border-t border-[#ECECEC] pt-5" : ""}>
                  <h3 className="mb-1.5 flex items-center gap-2 text-[15px] font-bold text-knock-text">
                    <span className="h-[18px] w-[4px] rounded" style={{ backgroundColor: accentColor }} />
                    {st.title}
                  </h3>
                  {st.desc && <p className="mb-3 text-[13px] text-knock-text-secondary">{st.desc}</p>}
                  <Points items={st.points} />
                  {st.actions && <Actions items={st.actions} />}
                  {st.images.map((im, j) => (
                    <ManualImage key={j} img={im} />
                  ))}
                </div>
              ))
            ) : (
              <>
                {s.points && <Points items={s.points} />}
                {s.actions && <Actions items={s.actions} />}
                {s.images?.map((im, j) => (
                  <ManualImage key={j} img={im} />
                ))}
                {s.note && (
                  <div className="mt-3 rounded-xl border border-[#F4E3C4] bg-[#FFF8EC] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#8A6A2E]">
                    {s.note}
                  </div>
                )}
                {s.sub && (
                  <div className="mt-5 rounded-2xl border border-[#ECECEC] bg-[#FBFBFC] p-4">
                    <h3 className="mb-1.5 flex items-center gap-2 text-[15px] font-bold text-knock-text">
                      <span className="h-[18px] w-[4px] rounded" style={{ backgroundColor: accentColor }} />
                      {s.sub.title}
                    </h3>
                    <p className="mb-3 text-[13px] text-knock-text-secondary">{s.sub.desc}</p>
                    <Points items={s.sub.points} />
                    {s.sub.images.map((im, j) => (
                      <ManualImage key={j} img={im} />
                    ))}
                  </div>
                )}
              </>
            )}

            <NextBox text={s.next} />
          </section>
        ))}

        {/* 全体の流れ */}
        <section className="rounded-2xl bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h2 className="mb-4 text-[16px] font-bold text-knock-text">全体の流れ</h2>
          <ol className="flex flex-col gap-3">
            {[
              "つながり申請を承認",
              "発注依頼を受注（初回のみ口座情報を登録）",
              "発注者が確定 → 注文書を確認",
              "（必要に応じて）追加工事を承諾",
              "施工 → 施工報告（発注書ごと）→ 工事を締める",
              "発注者が工事完了を承認 → 請求書発行へ",
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FDF2E3] text-[12px] font-extrabold" style={{ color: accentColor }}>{i + 1}</span>
                <span className="pt-1">{t}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 発注者マニュアルへ */}
        <Link
          href="/manual/orderer"
          className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98]"
          style={{ borderLeft: "4px solid #D1D5DB" }}
        >
          <div>
            <p className="text-[14px] font-bold text-knock-text">発注者用マニュアル</p>
            <p className="text-[12px] text-knock-text-secondary">発注する方向け（準備中）</p>
          </div>
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500">準備中</span>
        </Link>
      </div>
    </div>
  );
}
