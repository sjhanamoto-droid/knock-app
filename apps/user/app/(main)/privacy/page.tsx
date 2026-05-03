"use client";

import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";

const sections = [
  {
    title: "1. 個人情報の収集",
    body: "当社は、本サービスの提供にあたり、氏名、メールアドレス、電話番号、住所、会社情報などの個人情報をご提供いただく場合があります。収集は適法かつ公正な手段により行います。",
  },
  {
    title: "2. 利用目的",
    body: "取得した個人情報は、本サービスの提供・運営、利用者へのお知らせ・サポート対応、サービス改善のための分析、法令上の義務の履行を目的として利用します。目的外の利用は行いません。",
  },
  {
    title: "3. 第三者提供",
    body: "当社は、法令に基づく場合、利用者の同意がある場合、業務委託先への提供（守秘義務あり）を除き、個人情報を第三者に提供しません。提供する場合は事前にご通知します。",
  },
  {
    title: "4. 個人情報の管理",
    body: "当社は、個人情報の漏洩・滅失・毀損を防ぐため、適切なセキュリティ対策を実施します。不要となった個人情報は速やかに削除します。委託先に対しても適切な監督を行います。",
  },
  {
    title: "5. Cookie の使用",
    body: "本サービスでは、サービス品質向上のためにCookieを使用する場合があります。Cookieはブラウザの設定で無効化できますが、一部機能が利用できなくなる場合があります。",
  },
  {
    title: "6. お問い合わせ先",
    body: "個人情報の開示・訂正・削除のご依頼、またはプライバシーポリシーに関するお問い合わせは、info@knock-app.jp までご連絡ください。合理的な期間内に対応いたします。",
  },
];

export default function PrivacyPage() {
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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">プライバシーポリシー</h1>
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
            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="text-[14px] font-bold text-knock-text mb-1.5">{section.title}</h2>
                <p className="text-[13px] leading-relaxed text-knock-text-secondary">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
