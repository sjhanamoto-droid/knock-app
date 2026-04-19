"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useMode } from "@/lib/hooks/use-mode";
import { getProfile } from "@/lib/actions/profile";
import { getTrustScore } from "@/lib/actions/trust-score-page";
import { userRoleLabels, companyTypeLabels } from "@knock/utils";
import { SideMenu } from "@/components/side-menu";

/* ──────────── Label Maps ──────────── */

const genderLabels: Record<string, string> = {
  MALE: "男性",
  FEMALE: "女性",
  OTHER: "その他",
  UNSPECIFIED: "未回答",
};

const workEligibilityLabels: Record<string, string> = {
  JAPANESE_NATIONAL: "日本国籍",
  PERMANENT_RESIDENT: "外国籍（永住者・定住者等）",
  SPECIFIED_SKILLED: "外国籍（特定技能・建設分野）",
  WORK_VISA: "外国籍（技人国ビザ・高度専門職）",
  OTHER: "上記に該当しない",
};

const companyFormLabels: Record<string, string> = {
  CORPORATION: "法人",
  INDIVIDUAL: "個人事業主",
};

const workforceCapacityLabels: Record<string, string> = {
  ONE: "1人",
  TWO_TO_TEN: "2〜10人",
  ELEVEN_TO_THIRTY: "11〜30人",
  THIRTY_ONE_TO_FIFTY: "31〜50人",
  FIFTY_PLUS: "51人〜",
};

const constructionPermitLabels: Record<string, string> = {
  NONE: "取得していない",
  MLIT_GENERAL: "国土交通大臣許可 一般",
  MLIT_SPECIAL: "国土交通大臣許可 特定",
  GOVERNOR_GENERAL: "都道府県知事許可 一般",
  GOVERNOR_SPECIAL: "都道府県知事許可 特定",
};

const invoiceRegistrationLabels: Record<string, string> = {
  NOT_ENTERED: "未入力",
  NOT_REGISTERED: "未登録",
  REGISTERED: "登録済み",
};

type Profile = Awaited<ReturnType<typeof getProfile>>;
type TrustScoreData = Awaited<ReturnType<typeof getTrustScore>>;

/* ──────────── Icons ──────────── */

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M3 6H19M3 11H19M3 16H19" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 2C7.686 2 5 4.686 5 8V12L3 15H19L17 12V8C17 4.686 14.314 2 11 2Z" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 18C9 19.105 9.895 20 11 20C12.105 20 13 19.105 13 18" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M6 2L5 4H2C1.45 4 1 4.45 1 5V13C1 13.55 1.45 14 2 14H14C14.55 14 15 13.55 15 13V5C15 4.45 14.55 4 14 4H11L10 2H6Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect width="18" height="18" rx="4" fill="#3B82F6" />
      <path d="M5 13L6.5 13L11.5 8L10 6.5L5 11.5V13Z" fill="white" />
      <path d="M12.5 5.5L13.5 6.5L12 8L11 7L12.5 5.5Z" fill="white" />
    </svg>
  );
}

/* ──────────── Field Row ──────────── */

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 py-3.5 border-b border-gray-100 last:border-b-0">
      <span className="text-[12px] font-bold text-knock-text">{label}</span>
      <span className={`text-[14px] ${value ? "text-knock-text-secondary" : "text-gray-400"}`}>
        {value || "─"}
      </span>
    </div>
  );
}

/* ──────────── Section Card ──────────── */

function SectionCard({
  title,
  editHref,
  onEdit,
  children,
}: {
  title: string;
  editHref?: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <h3 className="text-[15px] font-bold text-knock-text">{title}</h3>
        {editHref && (
          <Link href={editHref} className="text-[13px] font-medium text-knock-orange">
            編集する
          </Link>
        )}
        {onEdit && (
          <button onClick={onEdit} className="text-[13px] font-medium text-knock-orange">
            編集する
          </button>
        )}
      </div>
      <div className="px-5 pb-4">{children}</div>
    </div>
  );
}

/* ──────────── Main Page ──────────── */

export default function MyPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"personal" | "company">("personal");
  const [profile, setProfile] = useState<Profile>(null);
  const [trustScore, setTrustScore] = useState<TrustScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { accentColor, isContractor } = useMode();

  useEffect(() => {
    Promise.all([getProfile(), getTrustScore()])
      .then(([p, s]) => {
        setProfile(p);
        setTrustScore(s);
      })
      .catch((err) => {
        console.error("[MyPage] error:", err);
        setError(err instanceof Error ? err.message : "プロフィールの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-[14px] text-red-600 text-center">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-700"
        >
          再読み込み
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const scoreValue = trustScore ? Number(trustScore.overallScore) : 0;

  const fullName = [profile.lastName, profile.firstName].filter(Boolean).join(" ");
  const furigana = [profile.lastNameKana, profile.firstNameKana].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-50">
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={fullName || undefined}
        companyName={profile.company?.name || undefined}
      />

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <MenuIcon />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-[17px] font-bold text-knock-text">マイページ</h1>
            <div className="mt-0.5 h-[3px] w-10 rounded-full bg-knock-orange" />
          </div>
          <Link
            href="/notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <BellIcon />
          </Link>
        </div>
      </header>

      {/* ─── Cover Photo + Avatar ─── */}
      <div className="relative">
        {/* Cover photo */}
        <div className="h-[200px] w-full bg-gray-300 overflow-hidden">
          <div className="h-full w-full bg-gradient-to-br from-gray-400 to-gray-500" />
        </div>

        {/* Camera icon on cover photo - bottom right */}
        <button className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white">
          <CameraIcon size={16} />
        </button>

        {/* Avatar overlapping cover photo bottom-left */}
        <div className="absolute -bottom-10 left-4">
          <div className="relative">
            <div
              className="h-20 w-20 overflow-hidden rounded-full border-3 border-white shadow-md"
              style={{ borderWidth: 3 }}
            >
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[24px] font-bold"
                  style={{ backgroundColor: `var(--mode-accent-bg)`, color: accentColor }}
                >
                  {profile.lastName?.charAt(0)}
                </div>
              )}
            </div>
            {/* Camera icon on avatar */}
            <button className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white">
              <CameraIcon size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* spacer for avatar overlap */}
      <div className="h-12" />

      {/* ─── Tab Bar ─── */}
      <div className="flex gap-2 px-4 py-3 bg-gray-50">
        <button
          onClick={() => setActiveTab("personal")}
          className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
            activeTab === "personal"
              ? "bg-gray-800 text-white"
              : "bg-transparent text-gray-400"
          }`}
        >
          本人情報
        </button>
        <button
          onClick={() => setActiveTab("company")}
          className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
            activeTab === "company"
              ? "bg-gray-800 text-white"
              : "bg-transparent text-gray-400"
          }`}
        >
          会社情報
        </button>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="flex flex-col gap-3 px-4 pb-8">
        {activeTab === "personal" && (
          <>
            {/* ─── 基本情報 ─── */}
            <SectionCard title="基本情報" editHref="/mypage/edit">
              <FieldRow label="氏名" value={fullName || null} />
              <FieldRow label="ふりがな" value={furigana || null} />
              <FieldRow
                label="性別"
                value={profile.gender ? genderLabels[profile.gender] : null}
              />
              <FieldRow
                label="生年月日"
                value={
                  profile.dateOfBirth
                    ? new Date(profile.dateOfBirth).toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : null
                }
              />
              <FieldRow
                label="年齢"
                value={
                  profile.dateOfBirth
                    ? `${Math.floor(
                        (Date.now() - new Date(profile.dateOfBirth).getTime()) /
                          (1000 * 60 * 60 * 24 * 365.25)
                      )}歳`
                    : null
                }
              />
              <FieldRow label="メールアドレス" value={profile.email} />
              <FieldRow label="電話番号" value={profile.telNumber || null} />
              <FieldRow
                label="居住地"
                value={
                  profile.company?.prefecture || profile.company?.city
                    ? [profile.company.prefecture, profile.company.city].filter(Boolean).join("")
                    : null
                }
              />
              <FieldRow
                label="就労資格"
                value={profile.workEligibility ? workEligibilityLabels[profile.workEligibility] : null}
              />
              <FieldRow label="屋号" value={profile.tradeName || null} />
              <FieldRow
                label="保有資格"
                value={
                  profile.qualifications && profile.qualifications.length > 0
                    ? profile.qualifications.map((q) => q.qualification.name).join(", ")
                    : null
                }
              />
              <FieldRow
                label="労災"
                value={
                  profile.workersCompInsurance === true
                    ? "加入している"
                    : profile.workersCompInsurance === false
                    ? "加入していない"
                    : null
                }
              />

              {/* Trust Score */}
              <div className="border-t border-gray-100 mt-2">
                <Link href="/mypage/trust-score" className="flex items-center gap-3 py-3.5">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2"
                    style={{ borderColor: accentColor }}
                  >
                    <span className="text-[14px] font-bold" style={{ color: accentColor }}>
                      {scoreValue > 0 ? scoreValue.toFixed(1) : "-.-"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-knock-text">信用スコア</p>
                    <p className="text-[11px] text-knock-text-secondary">
                      {trustScore && trustScore.totalTransactions > 0
                        ? `${trustScore.totalTransactions}件の取引実績`
                        : "取引実績なし"}
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3L11 8L6 13" stroke="#C0C0C0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </SectionCard>

            {/* ─── 受発注情報 ─── */}
            <SectionCard
              title="受発注情報"
              editHref={
                profile.role === "REPRESENTATIVE" || profile.role === "MANAGER"
                  ? "/mypage/company"
                  : undefined
              }
            >
              <FieldRow
                label="事業形態"
                value={profile.company?.companyForm ? companyFormLabels[profile.company.companyForm] : null}
              />
              <FieldRow
                label="対応エリア"
                value={
                  profile.company?.areas && profile.company.areas.length > 0
                    ? profile.company.areas.map((a) => a.area.name).join(", ")
                    : null
                }
              />
              <FieldRow
                label="稼働可能人数"
                value={
                  profile.company?.workforceCapacity
                    ? workforceCapacityLabels[profile.company.workforceCapacity]
                    : null
                }
              />
              <FieldRow
                label="対応職種"
                value={
                  profile.company?.occupations && profile.company.occupations.length > 0
                    ? profile.company.occupations.map((o) => o.occupationSubItem.name).join(", ")
                    : null
                }
              />
            </SectionCard>

            {/* ─── 許可証・保険・その他 ─── */}
            <SectionCard
              title="許可証・保険・その他"
              editHref={
                profile.role === "REPRESENTATIVE" || profile.role === "MANAGER"
                  ? "/mypage/company"
                  : undefined
              }
            >
              <FieldRow
                label="インボイス登録"
                value={
                  profile.company?.invoiceRegistration
                    ? invoiceRegistrationLabels[profile.company.invoiceRegistration]
                    : null
                }
              />
              <FieldRow
                label="建設業許可証"
                value={
                  profile.company?.constructionPermit
                    ? constructionPermitLabels[profile.company.constructionPermit]
                    : null
                }
              />
              <FieldRow
                label="社会保険"
                value={
                  profile.company?.socialInsurance === true
                    ? "加入している"
                    : profile.company?.socialInsurance === false
                    ? "加入していない"
                    : null
                }
              />
              <FieldRow
                label="その他保険"
                value={
                  profile.company?.insurances && profile.company.insurances.length > 0
                    ? profile.company.insurances.map((i) => i.type).join(", ")
                    : null
                }
              />
              <FieldRow label="ホームページ" value={profile.company?.hpUrl || null} />
            </SectionCard>
          </>
        )}

        {activeTab === "company" && profile.company && (
          <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            {/* Edit button top-right */}
            {(profile.role === "REPRESENTATIVE" || profile.role === "MANAGER") && (
              <div className="flex items-center justify-end px-4 pt-4">
                <Link href="/mypage/company">
                  <EditIcon />
                </Link>
              </div>
            )}

            <div className="px-4 pb-4 pt-2">
              <FieldRow label="企業名" value={profile.company.name || null} />
              <FieldRow
                label="種別"
                value={companyTypeLabels[profile.company.type] ?? profile.company.type}
              />
              <FieldRow label="メール" value={profile.company.email || null} />
              <FieldRow label="電話番号" value={profile.company.telNumber || null} />
              {(profile.company.prefecture || profile.company.city) && (
                <FieldRow
                  label="所在地"
                  value={[
                    profile.company.prefecture,
                    profile.company.city,
                    profile.company.streetAddress,
                    profile.company.building,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "company" && !profile.company && (
          <div className="flex flex-col items-center justify-center py-12 rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <p className="text-[14px] text-knock-text-secondary">会社情報がありません</p>
          </div>
        )}

        {/* ─── Menu ─── */}
        <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          {[
            ...(isContractor
              ? [{ href: "/mypage/availability", label: "空き日カレンダー" }]
              : []),
            { href: "/mypage/trust-score", label: "信用スコア詳細" },
            { href: "/documents", label: "帳票管理" },
            { href: "/members", label: "メンバー管理" },
            { href: "/templates", label: "テンプレート管理" },
            { href: "/notifications", label: "通知一覧" },
            { href: "/mypage/plan", label: "プラン管理" },
          ].map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-4 py-3.5 transition-colors active:bg-gray-50 ${
                i > 0 ? "border-t border-gray-100" : ""
              }`}
            >
              <span className="text-[14px] font-medium text-knock-text">{item.label}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="#C0C0C0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>

        {/* ─── Logout ─── */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-2xl bg-white py-3.5 text-center text-[14px] font-medium text-red-600 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-colors active:bg-red-50"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
