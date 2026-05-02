"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getProfile,
  updateCompany,
  saveCompanyAreas,
  saveCompanyInsurances,
} from "@/lib/actions/profile";
import { getAreas } from "@/lib/actions/contractors";
import { useMode } from "@/lib/hooks/use-mode";
import {
  getOccupationMasters,
  getCompanyOccupations,
  saveCompanyOccupations,
} from "@/lib/actions/occupations";
import OccupationSelector from "@/components/occupation-selector";
import { getAddressFromPostalCode } from "@knock/utils";

type Profile = Awaited<ReturnType<typeof getProfile>>;
type MajorItem = Awaited<ReturnType<typeof getOccupationMasters>>[number];
type Selection = { occupationSubItemId: string; note?: string };
type AreaMaster = { id: string; name: string };

const INSURANCE_TYPES = [
  "労働災害総合保険",
  "使用者賠償責任保険（EL保険）",
  "請負業者賠償責任保険",
  "第三者賠償責任保険",
  "生産物賠償責任保険（PL保険）",
  "建設工事保険",
  "土木工事保険",
  "組立保険",
] as const;

const inputCls =
  "w-full rounded-xl bg-[#F0F0F0] px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-knock-orange/30";

/* ──────────── Wavy Underline SVG ──────────── */

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
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

/* ──────────── Main Page ──────────── */

export default function CompanyEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get("section"); // info | order | license | bank | null(=all)
  const showInfo = !section || section === "info";
  const showOrder = !section || section === "order";
  const showLicense = !section || section === "license";
  const showBank = !section || section === "bank";
  const showBilling = !section || section === "billing";
  const { accentColor } = useMode();

  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    nameKana: "",
    email: "",
    telNumber: "",
    postalCode: "",
    prefecture: "",
    city: "",
    streetAddress: "",
    building: "",
    hpUrl: "",
    invoiceNumber: "",
    bankName: "",
    bankBranchName: "",
    bankAccountType: "",
    bankAccountNumber: "",
    bankAccountName: "",
  });

  // Address lookup state
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");

  // Stamp image state
  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const [uploadingStamp, setUploadingStamp] = useState(false);

  // Occupation state
  const [masters, setMasters] = useState<MajorItem[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [savingOcc, setSavingOcc] = useState(false);
  const [occSaved, setOccSaved] = useState(false);

  // 受発注情報 state
  const [areaMasters, setAreaMasters] = useState<AreaMaster[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [companyForm, setCompanyForm] = useState("");
  const [workforceCapacity, setWorkforceCapacity] = useState("");
  const [savingBiz, setSavingBiz] = useState(false);
  const [bizSaved, setBizSaved] = useState(false);

  // 許可証・保険・その他 state
  const [invoiceRegistration, setInvoiceRegistration] = useState("");
  const [constructionPermit, setConstructionPermit] = useState("");
  const [socialInsurance, setSocialInsurance] = useState("");
  const [selectedInsurances, setSelectedInsurances] = useState<string[]>([]);
  const [savingLicense, setSavingLicense] = useState(false);
  const [licenseSaved, setLicenseSaved] = useState(false);

  // 請求設定 state
  const [billingClosingDay, setBillingClosingDay] = useState("");
  const [billingGraceDays, setBillingGraceDays] = useState("5");
  const [paymentDueType, setPaymentDueType] = useState("");
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingSaved, setBillingSaved] = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (!p?.company) {
          router.replace("/mypage");
          return;
        }
        setProfile(p);
        setStampPreview(p.company.stampImage ?? null);
        const c = p.company;
        setFormData({
          name: c.name ?? "",
          nameKana: c.nameKana ?? "",
          email: c.email ?? "",
          telNumber: c.telNumber ?? "",
          postalCode: c.postalCode ?? "",
          prefecture: c.prefecture ?? "",
          city: c.city ?? "",
          streetAddress: c.streetAddress ?? "",
          building: c.building ?? "",
          hpUrl: c.hpUrl ?? "",
          invoiceNumber: c.invoiceNumber ?? "",
          bankName: c.bankName ?? "",
          bankBranchName: c.bankBranchName ?? "",
          bankAccountType: c.bankAccountType ?? "",
          bankAccountNumber: c.bankAccountNumber ?? "",
          bankAccountName: c.bankAccountName ?? "",
        });
        // 受発注情報
        setCompanyForm(c.companyForm ?? "");
        setWorkforceCapacity(c.workforceCapacity ?? "");
        setSelectedAreaIds(c.areas?.map((a) => a.area.id) ?? []);
        // 許可証・保険・その他
        setInvoiceRegistration(c.invoiceRegistration ?? "");
        setConstructionPermit(c.constructionPermit ?? "");
        setSocialInsurance(
          c.socialInsurance === true ? "true" : c.socialInsurance === false ? "false" : ""
        );
        setSelectedInsurances(c.insurances?.map((i) => i.type) ?? []);
        // 請求設定
        setBillingClosingDay(c.billingClosingDay?.toString() ?? "");
        setBillingGraceDays(c.billingGraceDays?.toString() ?? "5");
        setPaymentDueType(c.paymentDueType ?? "");
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "プロフィールの取得に失敗しました");
        setLoading(false);
      });

    getOccupationMasters().then(setMasters);
    getAreas().then(setAreaMasters);
    getCompanyOccupations().then((occs) => {
      setSelections(
        occs.map((o) => ({
          occupationSubItemId: o.occupationSubItemId,
          note: o.note ?? undefined,
        }))
      );
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateCompany({
        name: formData.name || undefined,
        nameKana: formData.nameKana || undefined,
        email: formData.email || undefined,
        telNumber: formData.telNumber || undefined,
        postalCode: formData.postalCode || undefined,
        prefecture: formData.prefecture || undefined,
        city: formData.city || undefined,
        streetAddress: formData.streetAddress || undefined,
        building: formData.building || undefined,
        hpUrl: formData.hpUrl || undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
        bankName: formData.bankName || undefined,
        bankBranchName: formData.bankBranchName || undefined,
        bankAccountType: (formData.bankAccountType as "ORDINARY" | "CURRENT") || undefined,
        bankAccountNumber: formData.bankAccountNumber || undefined,
        bankAccountName: formData.bankAccountName || undefined,
      });
      const updated = await getProfile();
      if (updated) setProfile(updated);
      // registrationStep が 2 になっていたら個人情報入力へ誘導
      const nextStep = updated?.company?.registrationStep;
      if (nextStep === 2) {
        setSuccess("保存しました。次に個人情報を入力してください。");
        setTimeout(() => router.push("/mypage/edit"), 1500);
      } else {
        setSuccess("保存しました");
        setTimeout(() => router.push("/mypage?tab=business"), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  function set(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFetchAddress() {
    setAddressError("");
    if (!formData.postalCode) {
      setAddressError("郵便番号を入力してください");
      return;
    }
    setAddressLoading(true);
    try {
      const result = await getAddressFromPostalCode(formData.postalCode);
      if (!result) {
        setAddressError("住所が見つかりませんでした");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        prefecture: result.prefecture,
        city: result.city + result.town,
      }));
    } catch {
      setAddressError("住所の取得に失敗しました");
    } finally {
      setAddressLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col">
      {/* ─── Header (same as /mypage/edit) ─── */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M13 4L7 10L13 16"
                stroke="#1A1A1A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
              {section === "info" ? "会社情報編集" : section === "order" ? "受発注情報編集" : section === "license" ? "許可証・保険編集" : section === "bank" ? "振込先口座編集" : section === "billing" ? "請求設定編集" : "会社情報編集"}
            </h1>
            <WavyUnderline color={accentColor} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-600">
            {success}
          </div>
        )}

        {/* 基本情報 + 住所 + 振込先口座 (共通form) */}
        {(showInfo || showBank) && (
        <form onSubmit={handleSubmit}>
          {showInfo && (
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-gray-500">
              基本情報
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">企業名</label>
                <input value={formData.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">フリガナ</label>
                <input value={formData.nameKana} onChange={(e) => set("nameKana", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">メールアドレス</label>
                <input value={formData.email} onChange={(e) => set("email", e.target.value)} type="email" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">電話番号</label>
                <input value={formData.telNumber} onChange={(e) => set("telNumber", e.target.value)} type="tel" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">HP URL</label>
                <input value={formData.hpUrl} onChange={(e) => set("hpUrl", e.target.value)} className={inputCls} placeholder="https://" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">適格請求書番号</label>
                <input value={formData.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} className={inputCls} placeholder="T1234567890123" />
              </div>
            </div>
          </div>
          )}

          {/* 住所 */}
          {showInfo && (
          <div className={`${showInfo && !showBank ? "" : "mt-4"} rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]`}>
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-gray-500">
              住所
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">郵便番号</label>
                <div className="flex gap-2">
                  <input value={formData.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputCls + " flex-1"} placeholder="123-4567" />
                  <button
                    type="button"
                    onClick={handleFetchAddress}
                    disabled={addressLoading}
                    className="shrink-0 rounded-xl bg-knock-orange px-4 py-3 text-[13px] font-bold text-white transition-opacity disabled:opacity-50"
                  >
                    {addressLoading ? "取得中..." : "住所取得"}
                  </button>
                </div>
                {addressError && <p className="mt-1.5 text-[12px] text-red-600">{addressError}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">都道府県</label>
                <input value={formData.prefecture} onChange={(e) => set("prefecture", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">市区町村</label>
                <input value={formData.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">番地</label>
                <input value={formData.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">建物名</label>
                <input value={formData.building} onChange={(e) => set("building", e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>
          )}

          {/* 振込先口座 */}
          {showBank && (
          <div className={`${showInfo ? "mt-4" : ""} rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]`}>
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-gray-500">
              振込先口座
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">銀行名</label>
                <input value={formData.bankName} onChange={(e) => set("bankName", e.target.value)} className={inputCls} placeholder="例: みずほ銀行" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">支店名</label>
                <input value={formData.bankBranchName} onChange={(e) => set("bankBranchName", e.target.value)} className={inputCls} placeholder="例: 渋谷支店" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">口座種別</label>
                <select value={formData.bankAccountType} onChange={(e) => set("bankAccountType", e.target.value)} className={inputCls}>
                  <option value="">未選択</option>
                  <option value="ORDINARY">普通</option>
                  <option value="CURRENT">当座</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">口座番号</label>
                <input value={formData.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} className={inputCls} placeholder="1234567" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">口座名義（カタカナ）</label>
                <input value={formData.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} className={inputCls} placeholder="カ）ノックカブシキガイシャ" />
              </div>
            </div>
          </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-knock-orange py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "保存中..." : section === "bank" ? "口座情報を保存" : section === "info" ? "会社情報を保存" : "会社情報・口座を保存"}
          </button>
        </form>
        )}

        {/* 受発注情報 */}
        {showOrder && (
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-gray-500">
            受発注情報
          </h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">事業形態</label>
              <select
                value={companyForm}
                onChange={(e) => setCompanyForm(e.target.value)}
                className={inputCls}
              >
                <option value="">未選択</option>
                <option value="CORPORATION">法人</option>
                <option value="INDIVIDUAL">個人事業主</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">対応エリア</label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-3">
                {areaMasters.map((area) => (
                  <label key={area.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedAreaIds.includes(area.id)}
                      onChange={() => {
                        setSelectedAreaIds((prev) =>
                          prev.includes(area.id)
                            ? prev.filter((id) => id !== area.id)
                            : [...prev, area.id]
                        );
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-knock-orange accent-knock-orange"
                    />
                    <span className="text-[13px] text-knock-text">{area.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">稼働可能人数</label>
              <select
                value={workforceCapacity}
                onChange={(e) => setWorkforceCapacity(e.target.value)}
                className={inputCls}
              >
                <option value="">未選択</option>
                <option value="ONE">1人</option>
                <option value="TWO_TO_TEN">2〜10人</option>
                <option value="ELEVEN_TO_THIRTY">11〜30人</option>
                <option value="THIRTY_ONE_TO_FIFTY">31〜50人</option>
                <option value="FIFTY_PLUS">51人〜</option>
              </select>
            </div>

            {/* 対応職種 (inline) */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[13px] font-medium text-gray-700">対応職種</label>
                {selections.length > 0 && (
                  <span className="text-[12px] text-knock-text-secondary">
                    {selections.length}件選択中
                  </span>
                )}
              </div>
              <OccupationSelector
                masters={masters}
                value={selections}
                onChange={setSelections}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              setSavingBiz(true);
              setBizSaved(false);
              try {
                await Promise.all([
                  updateCompany({
                    companyForm: (companyForm as "CORPORATION" | "INDIVIDUAL") || null,
                    workforceCapacity:
                      (workforceCapacity as
                        | "ONE"
                        | "TWO_TO_TEN"
                        | "ELEVEN_TO_THIRTY"
                        | "THIRTY_ONE_TO_FIFTY"
                        | "FIFTY_PLUS") || null,
                  }),
                  saveCompanyAreas(selectedAreaIds),
                  saveCompanyOccupations(selections),
                ]);
                setBizSaved(true);
                setTimeout(() => router.push("/mypage?tab=business"), 1500);
              } catch (err) {
                setError(err instanceof Error ? err.message : "受発注情報の保存に失敗しました");
              } finally {
                setSavingBiz(false);
              }
            }}
            disabled={savingBiz}
            className="mt-4 w-full rounded-xl bg-knock-orange py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {savingBiz ? "保存中..." : bizSaved ? "保存しました" : "受発注情報を保存"}
          </button>
        </div>
        )}

        {/* 許可証・保険・その他 */}
        {showLicense && (
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-gray-500">
            許可証・保険・その他
          </h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">インボイス登録</label>
              <select
                value={invoiceRegistration}
                onChange={(e) => setInvoiceRegistration(e.target.value)}
                className={inputCls}
              >
                <option value="">未選択</option>
                <option value="NOT_ENTERED">未入力</option>
                <option value="NOT_REGISTERED">未登録</option>
                <option value="REGISTERED">登録済み</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">建設業許可証</label>
              <select
                value={constructionPermit}
                onChange={(e) => setConstructionPermit(e.target.value)}
                className={inputCls}
              >
                <option value="">未選択</option>
                <option value="NONE">取得していない</option>
                <option value="MLIT_GENERAL">国土交通大臣許可 一般</option>
                <option value="MLIT_SPECIAL">国土交通大臣許可 特定</option>
                <option value="GOVERNOR_GENERAL">都道府県知事許可 一般</option>
                <option value="GOVERNOR_SPECIAL">都道府県知事許可 特定</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">社会保険</label>
              <select
                value={socialInsurance}
                onChange={(e) => setSocialInsurance(e.target.value)}
                className={inputCls}
              >
                <option value="">未選択</option>
                <option value="true">加入している</option>
                <option value="false">加入していない</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">その他保険</label>
              <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
                {INSURANCE_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedInsurances.includes(type)}
                      onChange={() => {
                        setSelectedInsurances((prev) =>
                          prev.includes(type)
                            ? prev.filter((t) => t !== type)
                            : [...prev, type]
                        );
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-knock-orange accent-knock-orange"
                    />
                    <span className="text-[13px] text-knock-text">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              setSavingLicense(true);
              setLicenseSaved(false);
              try {
                await Promise.all([
                  updateCompany({
                    invoiceRegistration:
                      (invoiceRegistration as "NOT_ENTERED" | "NOT_REGISTERED" | "REGISTERED") || null,
                    constructionPermit:
                      (constructionPermit as
                        | "NONE"
                        | "MLIT_GENERAL"
                        | "MLIT_SPECIAL"
                        | "GOVERNOR_GENERAL"
                        | "GOVERNOR_SPECIAL") || null,
                    socialInsurance:
                      socialInsurance === "true"
                        ? true
                        : socialInsurance === "false"
                        ? false
                        : null,
                  }),
                  saveCompanyInsurances(selectedInsurances),
                ]);
                setLicenseSaved(true);
                setTimeout(() => router.push("/mypage?tab=business"), 1500);
              } catch (err) {
                setError(err instanceof Error ? err.message : "許可証・保険情報の保存に失敗しました");
              } finally {
                setSavingLicense(false);
              }
            }}
            disabled={savingLicense}
            className="mt-4 w-full rounded-xl bg-knock-orange py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {savingLicense ? "保存中..." : licenseSaved ? "保存しました" : "許可証・保険を保存"}
          </button>
        </div>
        )}

        {/* 請求設定 */}
        {showBilling && (
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-gray-500">
            請求設定
          </h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">締め日</label>
              <select
                value={billingClosingDay}
                onChange={(e) => setBillingClosingDay(e.target.value)}
                className={inputCls}
              >
                <option value="">月末</option>
                <option value="25">25日</option>
                <option value="20">20日</option>
                <option value="15">15日</option>
                <option value="10">10日</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">猶予日数</label>
              <select
                value={billingGraceDays}
                onChange={(e) => setBillingGraceDays(e.target.value)}
                className={inputCls}
              >
                <option value="3">3日</option>
                <option value="5">5日</option>
                <option value="7">7日</option>
                <option value="10">10日</option>
              </select>
              <p className="mt-1 text-[11px] text-gray-400">締め日後、請求書の確定までの猶予期間</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">支払期日</label>
              <select
                value={paymentDueType}
                onChange={(e) => setPaymentDueType(e.target.value)}
                className={inputCls}
              >
                <option value="">未選択</option>
                <option value="NEXT_MONTH_END">翌月末</option>
                <option value="NEXT_MONTH_25">翌月25日</option>
                <option value="NEXT_MONTH_20">翌月20日</option>
                <option value="NEXT_MONTH_15">翌月15日</option>
                <option value="TWO_MONTHS_END">翌々月末</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              setSavingBilling(true);
              setBillingSaved(false);
              try {
                await updateCompany({
                  billingClosingDay: billingClosingDay ? parseInt(billingClosingDay) : null,
                  billingGraceDays: billingGraceDays ? parseInt(billingGraceDays) : null,
                  paymentDueType:
                    (paymentDueType as "NEXT_MONTH_END" | "NEXT_MONTH_25" | "NEXT_MONTH_20" | "NEXT_MONTH_15" | "TWO_MONTHS_END") || null,
                });
                setBillingSaved(true);
                setTimeout(() => router.push("/mypage?tab=business"), 1500);
              } catch (err) {
                setError(err instanceof Error ? err.message : "請求設定の保存に失敗しました");
              } finally {
                setSavingBilling(false);
              }
            }}
            disabled={savingBilling}
            className="mt-4 w-full rounded-xl bg-knock-orange py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {savingBilling ? "保存中..." : billingSaved ? "保存しました" : "請求設定を保存"}
          </button>
        </div>
        )}

        {/* 印鑑画像 */}
        {showInfo && (
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-gray-500">印鑑画像</h3>
          <p className="mb-3 text-[12px] text-gray-500">帳票（注文書・納品書・請求書）に自動挿入されます</p>

          {stampPreview ? (
            <div className="flex items-center gap-4">
              <img src={stampPreview} alt="印鑑" className="h-20 w-20 rounded border border-gray-200 object-contain bg-white p-1" />
              <button
                type="button"
                onClick={async () => {
                  setUploadingStamp(true);
                  try {
                    await updateCompany({ stampImage: null });
                    setStampPreview(null);
                    const updated = await getProfile();
                    if (updated) setProfile(updated);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "削除に失敗しました");
                  } finally {
                    setUploadingStamp(false);
                  }
                }}
                disabled={uploadingStamp}
                className="rounded-lg border border-red-300 px-3 py-2 text-[13px] font-medium text-red-600 transition-colors active:bg-red-50 disabled:opacity-50"
              >
                削除
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-6 transition-colors hover:border-knock-orange">
              <CameraIcon size={24} />
              <span className="text-[13px] font-medium text-gray-500">
                {uploadingStamp ? "アップロード中..." : "PNG / JPEG画像を選択"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                disabled={uploadingStamp}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    setError("ファイルサイズは5MB以下にしてください");
                    return;
                  }
                  setUploadingStamp(true);
                  setError("");
                  try {
                    const fd = new FormData();
                    fd.append("files", file);
                    const res = await fetch("/api/upload", { method: "POST", body: fd });
                    if (!res.ok) throw new Error("アップロードに失敗しました");
                    const { urls } = await res.json();
                    const url = urls[0] as string;
                    await updateCompany({ stampImage: url });
                    setStampPreview(url);
                    const updated = await getProfile();
                    if (updated) setProfile(updated);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "アップロードに失敗しました");
                  } finally {
                    setUploadingStamp(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
