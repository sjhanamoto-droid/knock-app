"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerStep1, registerStep2, registerStep3 } from "@/lib/actions/registration";
import { getAddressFromPostalCode } from "@knock/utils";

/* ──────────── Schemas ──────────── */

const step1Schema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  passwordConfirm: z.string(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: "パスワードが一致しません",
  path: ["passwordConfirm"],
});

const step2Schema = z.object({
  companyForm: z.enum(["CORPORATION", "INDIVIDUAL"]),
  businessName: z.string().min(1, "事業者名を入力してください"),
  nameKana: z.string().min(1, "フリガナを入力してください"),
  postalCode: z.string().min(1, "郵便番号を入力してください"),
  prefecture: z.string().min(1, "都道府県を選択してください"),
  city: z.string().min(1, "市区町村を入力してください"),
  streetAddress: z.string().min(1, "番地を入力してください"),
  building: z.string().optional(),
  telNumber: z.string().min(1, "電話番号を入力してください"),
  invoiceNumber: z.string().optional(),
});

const step3Schema = z.object({
  lastName: z.string().min(1, "姓を入力してください"),
  firstName: z.string().min(1, "名を入力してください"),
  lastNameKana: z.string().min(1, "セイを入力してください"),
  firstNameKana: z.string().min(1, "メイを入力してください"),
  dateOfBirth: z.string().min(1, "生年月日を入力してください"),
  telPhone: z.string().min(1, "電話番号を入力してください"),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

/* ──────────── Prefectures ──────────── */

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

/* ──────────── Stepper ──────────── */

function Stepper({ current }: { current: number }) {
  const steps = ["アカウント", "会社情報", "担当者情報"];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className="w-8 h-0.5"
                style={{ backgroundColor: isDone ? "#F5A623" : "#E0E0E0" }}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold"
                style={{
                  backgroundColor: isActive || isDone ? "#F5A623" : "#E0E0E0",
                  color: isActive || isDone ? "#fff" : "#9CA3AF",
                }}
              >
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className="text-[10px] font-semibold whitespace-nowrap"
                style={{ color: isActive || isDone ? "#1A2340" : "#9CA3AF" }}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────── Input style helper ──────────── */

const inputStyle = {
  backgroundColor: "#F0F0F0",
  borderRadius: "12px",
  border: "none",
  color: "#1A2340",
};

const inputClass = "w-full px-4 py-4 text-[15px] outline-none";

/* ──────────── Main Page ──────────── */

export default function RegisterPage() {
  const [step, setStep] = useState(0); // 0 = type select, 1-3 = registration steps
  const [userType, setUserType] = useState<"ORDERER" | "CONTRACTOR" | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  /* ──── Step 1 Form ──── */
  const step1Form = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });

  async function onStep1(data: Step1Data) {
    setServerError(null);
    const result = await registerStep1({ email: data.email, password: data.password }, userType!);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    setCompanyId(result.companyId!);
    setCredentials({ email: data.email, password: data.password });
    setStep(2);
  }

  async function handleFetchAddress() {
    setAddressError(null);
    const postalCode = step2Form.getValues("postalCode");
    if (!postalCode) {
      setAddressError("郵便番号を入力してください");
      return;
    }
    setAddressLoading(true);
    try {
      const result = await getAddressFromPostalCode(postalCode);
      if (!result) {
        setAddressError("住所が見つかりませんでした");
        return;
      }
      step2Form.setValue("prefecture", result.prefecture, { shouldValidate: true });
      step2Form.setValue("city", result.city + result.town, { shouldValidate: true });
    } catch {
      setAddressError("住所の取得に失敗しました");
    } finally {
      setAddressLoading(false);
    }
  }

  /* ──── Step 2 Form ──── */
  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: { companyForm: "CORPORATION" },
  });

  async function onStep2(data: Step2Data) {
    setServerError(null);
    const result = await registerStep2(companyId!, data);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    setStep(3);
  }

  /* ──── Step 3 Form ──── */
  const step3Form = useForm<Step3Data>({ resolver: zodResolver(step3Schema) });

  async function onStep3(data: Step3Data) {
    setServerError(null);
    const result = await registerStep3(companyId!, data, credentials!);
    if (result?.error) {
      setServerError(result.error);
    }
    // Success: registerStep3 auto-redirects to /onboarding
  }

  /* ──── Type Selection (Step 0) ──── */
  if (step === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[430px]">
          <h1 className="text-[22px] font-bold text-center mb-2" style={{ color: "#1A2340" }}>
            新規登録
          </h1>
          <p className="text-[14px] text-center mb-10" style={{ color: "#6B6B6B" }}>
            利用形態を選択してください
          </p>

          <div className="flex flex-col gap-4">
            {/* 発注者 */}
            <button
              onClick={() => { setUserType("ORDERER"); setStep(1); }}
              className="flex items-center gap-4 rounded-2xl p-5 text-left transition-all active:scale-[0.98]"
              style={{
                border: "2px solid #3B82F6",
                backgroundColor: "rgba(59,130,246,0.04)",
              }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "#3B82F6" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9L12 2L21 9V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V9Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 21V12H15V21" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-[16px] font-bold" style={{ color: "#1A2340" }}>発注者として登録</p>
                <p className="text-[12px] mt-0.5" style={{ color: "#6B6B6B" }}>
                  工事を依頼する会社・個人の方
                </p>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="ml-auto shrink-0">
                <path d="M7 5L12 10L7 15" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* 受注者 */}
            <button
              onClick={() => { setUserType("CONTRACTOR"); setStep(1); }}
              className="flex items-center gap-4 rounded-2xl p-5 text-left transition-all active:scale-[0.98]"
              style={{
                border: "2px solid #F5A623",
                backgroundColor: "rgba(245,166,35,0.04)",
              }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "#F5A623" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6C5.45 2 5 2.45 5 3V21C5 21.55 5.45 22 6 22H18C18.55 22 19 21.55 19 21V7L14 2Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 2V7H19" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 15L11 17L15 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-[16px] font-bold" style={{ color: "#1A2340" }}>受注者として登録</p>
                <p className="text-[12px] mt-0.5" style={{ color: "#6B6B6B" }}>
                  工事を受注する職人・事業者の方
                </p>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="ml-auto shrink-0">
                <path d="M7 5L12 10L7 15" stroke="#F5A623" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mt-8 text-center">
            <a href="/login" className="text-[13px]" style={{ color: "#4A90D9" }}>
              アカウントをお持ちの方はこちら
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ──── Registration Steps 1-3 ──── */
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[430px]">
        {/* Back button */}
        <button
          onClick={() => step === 1 ? setStep(0) : setStep(step - 1)}
          className="flex items-center gap-1 mb-6 text-[14px] active:opacity-70"
          style={{ color: "#6B6B6B" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8L10 12" stroke="#6B6B6B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          戻る
        </button>

        <Stepper current={step} />

        {/* Server error */}
        {serverError && (
          <div
            className="rounded-xl px-4 py-3 text-sm mb-4"
            style={{ backgroundColor: "#FEE2E2", color: "#B91C1C" }}
          >
            {serverError}
          </div>
        )}

        {/* ──── Step 1: Account ──── */}
        {step === 1 && (
          <form onSubmit={step1Form.handleSubmit(onStep1)} className="space-y-4">
            <h2 className="text-[18px] font-bold mb-1" style={{ color: "#1A2340" }}>
              アカウント情報
            </h2>
            <p className="text-[13px] mb-4" style={{ color: "#6B6B6B" }}>
              {userType === "ORDERER" ? "発注者" : "受注者"}として登録します
            </p>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>
                メールアドレス
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="example@knock.co.jp"
                {...step1Form.register("email")}
                className={inputClass}
                style={inputStyle}
              />
              {step1Form.formState.errors.email && (
                <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>
                  {step1Form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>
                パスワード
              </label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="8文字以上"
                {...step1Form.register("password")}
                className={inputClass}
                style={inputStyle}
              />
              {step1Form.formState.errors.password && (
                <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>
                  {step1Form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>
                パスワード（確認）
              </label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="もう一度入力してください"
                {...step1Form.register("passwordConfirm")}
                className={inputClass}
                style={inputStyle}
              />
              {step1Form.formState.errors.passwordConfirm && (
                <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>
                  {step1Form.formState.errors.passwordConfirm.message}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={step1Form.formState.isSubmitting}
                className="w-full py-4 text-white font-bold text-[16px] transition-opacity"
                style={{
                  backgroundColor: "#F5A623",
                  borderRadius: "12px",
                  opacity: step1Form.formState.isSubmitting ? 0.7 : 1,
                }}
              >
                {step1Form.formState.isSubmitting ? "登録中..." : "次へ"}
              </button>
            </div>
          </form>
        )}

        {/* ──── Step 2: Company Info ──── */}
        {step === 2 && (
          <form onSubmit={step2Form.handleSubmit(onStep2)} className="space-y-4">
            <h2 className="text-[18px] font-bold mb-4" style={{ color: "#1A2340" }}>
              会社情報
            </h2>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>
                事業形態
              </label>
              <div className="flex gap-3">
                {(["CORPORATION", "INDIVIDUAL"] as const).map((v) => (
                  <label
                    key={v}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 cursor-pointer text-[14px] font-semibold transition-all"
                    style={{
                      backgroundColor: step2Form.watch("companyForm") === v ? "rgba(245,166,35,0.1)" : "#F0F0F0",
                      border: step2Form.watch("companyForm") === v ? "2px solid #F5A623" : "2px solid transparent",
                      color: "#1A2340",
                    }}
                  >
                    <input
                      type="radio"
                      value={v}
                      {...step2Form.register("companyForm")}
                      className="sr-only"
                    />
                    {v === "CORPORATION" ? "法人" : "個人事業主"}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>事業者名</label>
              <input placeholder="株式会社ノック" {...step2Form.register("businessName")} className={inputClass} style={inputStyle} />
              {step2Form.formState.errors.businessName && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step2Form.formState.errors.businessName.message}</p>}
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>フリガナ</label>
              <input placeholder="カブシキガイシャノック" {...step2Form.register("nameKana")} className={inputClass} style={inputStyle} />
              {step2Form.formState.errors.nameKana && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step2Form.formState.errors.nameKana.message}</p>}
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>郵便番号</label>
              <div className="flex gap-2">
                <input placeholder="000-0000" {...step2Form.register("postalCode")} className={inputClass + " flex-1"} style={inputStyle} />
                <button
                  type="button"
                  onClick={handleFetchAddress}
                  disabled={addressLoading}
                  className="shrink-0 rounded-xl px-4 py-3 text-[13px] font-bold text-white transition-opacity"
                  style={{ backgroundColor: "#F5A623", opacity: addressLoading ? 0.7 : 1 }}
                >
                  {addressLoading ? "取得中..." : "住所取得"}
                </button>
              </div>
              {step2Form.formState.errors.postalCode && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step2Form.formState.errors.postalCode.message}</p>}
              {addressError && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{addressError}</p>}
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>都道府県</label>
              <select {...step2Form.register("prefecture")} className={inputClass} style={inputStyle}>
                <option value="">選択</option>
                {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {step2Form.formState.errors.prefecture && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step2Form.formState.errors.prefecture.message}</p>}
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>市区町村</label>
              <input placeholder="渋谷区神宮前" {...step2Form.register("city")} className={inputClass} style={inputStyle} />
              {step2Form.formState.errors.city && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step2Form.formState.errors.city.message}</p>}
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>番地</label>
              <input placeholder="1-2-3" {...step2Form.register("streetAddress")} className={inputClass} style={inputStyle} />
              {step2Form.formState.errors.streetAddress && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step2Form.formState.errors.streetAddress.message}</p>}
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>建物名（任意）</label>
              <input placeholder="ノックビル 3F" {...step2Form.register("building")} className={inputClass} style={inputStyle} />
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>電話番号</label>
              <input type="tel" placeholder="03-1234-5678" {...step2Form.register("telNumber")} className={inputClass} style={inputStyle} />
              {step2Form.formState.errors.telNumber && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step2Form.formState.errors.telNumber.message}</p>}
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>インボイス番号（任意）</label>
              <input placeholder="T1234567890123" {...step2Form.register("invoiceNumber")} className={inputClass} style={inputStyle} />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={step2Form.formState.isSubmitting}
                className="w-full py-4 text-white font-bold text-[16px] transition-opacity"
                style={{
                  backgroundColor: "#F5A623",
                  borderRadius: "12px",
                  opacity: step2Form.formState.isSubmitting ? 0.7 : 1,
                }}
              >
                {step2Form.formState.isSubmitting ? "保存中..." : "次へ"}
              </button>
            </div>
          </form>
        )}

        {/* ──── Step 3: Personal Info ──── */}
        {step === 3 && (
          <form onSubmit={step3Form.handleSubmit(onStep3)} className="space-y-4">
            <h2 className="text-[18px] font-bold mb-4" style={{ color: "#1A2340" }}>
              担当者情報
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>姓</label>
                <input placeholder="山田" {...step3Form.register("lastName")} className={inputClass} style={inputStyle} />
                {step3Form.formState.errors.lastName && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step3Form.formState.errors.lastName.message}</p>}
              </div>
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>名</label>
                <input placeholder="太郎" {...step3Form.register("firstName")} className={inputClass} style={inputStyle} />
                {step3Form.formState.errors.firstName && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step3Form.formState.errors.firstName.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>セイ</label>
                <input placeholder="ヤマダ" {...step3Form.register("lastNameKana")} className={inputClass} style={inputStyle} />
                {step3Form.formState.errors.lastNameKana && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step3Form.formState.errors.lastNameKana.message}</p>}
              </div>
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>メイ</label>
                <input placeholder="タロウ" {...step3Form.register("firstNameKana")} className={inputClass} style={inputStyle} />
                {step3Form.formState.errors.firstNameKana && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step3Form.formState.errors.firstNameKana.message}</p>}
              </div>
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>生年月日</label>
              <input type="date" {...step3Form.register("dateOfBirth")} className={inputClass} style={inputStyle} />
              {step3Form.formState.errors.dateOfBirth && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step3Form.formState.errors.dateOfBirth.message}</p>}
            </div>

            <div>
              <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#1A2340" }}>電話番号</label>
              <input type="tel" placeholder="090-1234-5678" {...step3Form.register("telPhone")} className={inputClass} style={inputStyle} />
              {step3Form.formState.errors.telPhone && <p className="mt-1.5 text-xs" style={{ color: "#B91C1C" }}>{step3Form.formState.errors.telPhone.message}</p>}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={step3Form.formState.isSubmitting}
                className="w-full py-4 text-white font-bold text-[16px] transition-opacity"
                style={{
                  backgroundColor: "#F5A623",
                  borderRadius: "12px",
                  opacity: step3Form.formState.isSubmitting ? 0.7 : 1,
                }}
              >
                {step3Form.formState.isSubmitting ? "登録中..." : "登録を完了する"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
