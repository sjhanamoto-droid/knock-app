"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registrationStep1Schema,
  registrationStep2Schema,
  registrationStep3Schema,
  type RegistrationStep1Input,
  type RegistrationStep2Input,
  type RegistrationStep3Input,
} from "@knock/types";
import {
  registerStep1,
  registerStep2,
  registerStep3,
} from "@/lib/actions/registration";
import Link from "next/link";

type Props = { type: "ORDERER" | "CONTRACTOR" };

const STEP_LABELS = ["アカウント情報", "会社情報", "担当者情報"] as const;

function StepIndicator({
  currentStep,
}: {
  currentStep: 1 | 2 | 3 | "complete";
}) {
  const numericStep = currentStep === "complete" ? 4 : currentStep;

  return (
    <div className="mb-6">
      <div className="flex items-center">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const isCompleted = numericStep > stepNumber;
          const isActive = numericStep === stepNumber;
          const isFuture = numericStep < stepNumber;

          return (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={`
                    flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300
                    ${
                      isCompleted
                        ? "bg-knock-orange text-white"
                        : isActive
                          ? "bg-knock-orange text-white shadow-lg shadow-knock-orange/30"
                          : "border-2 border-knock-border text-knock-text-muted bg-white"
                    }
                  `}
                >
                  {isCompleted ? (
                    <span className="text-sm leading-none">&#10003;</span>
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={`
                    mt-1.5 whitespace-nowrap text-[10px] font-medium transition-colors duration-300
                    ${
                      isCompleted
                        ? "text-knock-text-secondary"
                        : isActive
                          ? "text-knock-text"
                          : "text-knock-text-muted"
                    }
                  `}
                >
                  {label}
                </span>
              </div>
              {index < STEP_LABELS.length - 1 && (
                <div
                  className={`
                    h-0.5 flex-1 -mt-4 mx-2 rounded-full transition-colors duration-500
                    ${isFuture ? "bg-knock-border" : "bg-knock-orange"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RegistrationForm({ type }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | "complete">(1);
  const [companyId, setCompanyId] = useState<string>("");
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
  }>({ email: "", password: "" });

  const subtitle =
    type === "ORDERER" ? "発注者アカウント登録" : "受注者アカウント登録";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      <div className="px-5 pt-8 pb-8 flex flex-col flex-1 max-w-[430px] mx-auto w-full">
        <div className="mb-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-knock-orange mx-auto">
            <span className="text-[28px] font-black text-white leading-none">K</span>
          </div>
          <p className="text-[14px] text-knock-text-secondary text-center mt-2">
            {subtitle}
          </p>
        </div>

        {step !== "complete" && <StepIndicator currentStep={step} />}

        <div className="transition-opacity duration-300">
          {step === 1 && (
            <div className="animate-[fadeSlideIn_0.35s_ease-out]">
              <Step1Form
                type={type}
                onSuccess={(id, creds) => {
                  setCompanyId(id);
                  setCredentials(creds);
                  setStep(2);
                }}
              />
            </div>
          )}

          {step === 2 && (
            <div className="animate-[fadeSlideIn_0.35s_ease-out]">
              <Step2Form
                companyId={companyId}
                onSuccess={() => setStep(3)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="animate-[fadeSlideIn_0.35s_ease-out]">
              <Step3Form
                companyId={companyId}
                credentials={credentials}
              />
            </div>
          )}

          {step === "complete" && (
            <div className="animate-[fadeSlideIn_0.4s_ease-out]">
              <CompleteView />
            </div>
          )}
        </div>

        <p className="text-[13px] text-knock-text-muted text-center mt-6">
          既にアカウントをお持ちの方は{" "}
          <Link
            href="/login"
            className="text-knock-orange font-medium hover:text-knock-amber transition-colors"
          >
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: アカウント情報
// ---------------------------------------------------------------------------

function Step1Form({
  type,
  onSuccess,
}: {
  type: "ORDERER" | "CONTRACTOR";
  onSuccess: (
    companyId: string,
    credentials: { email: string; password: string }
  ) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationStep1Input>({
    resolver: zodResolver(registrationStep1Schema),
  });

  const onSubmit = async (data: RegistrationStep1Input) => {
    setServerError(null);
    const result = await registerStep1(
      { email: data.email, password: data.password },
      type
    );
    if (result.error) {
      setServerError(result.error);
      return;
    }
    if (result.companyId) {
      onSuccess(result.companyId, {
        email: data.email,
        password: data.password,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-knock-red">
          {serverError}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-knock-text">
          メールアドレス <span className="text-knock-red">*</span>
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          className="mt-1.5 block w-full rounded-xl bg-[#F0F0F0] px-4 py-3 text-[14px] text-knock-text placeholder:text-knock-text-muted focus:outline-none focus:ring-2 focus:ring-knock-orange/30"
          placeholder="example@company.co.jp"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-knock-red">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-knock-text">
          パスワード <span className="text-knock-red">*</span>
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
          className="mt-1.5 block w-full rounded-xl bg-[#F0F0F0] px-4 py-3 text-[14px] text-knock-text placeholder:text-knock-text-muted focus:outline-none focus:ring-2 focus:ring-knock-orange/30"
        />
        <p className="mt-1 text-xs text-knock-text-muted">
          8文字以上で入力してください
        </p>
        {errors.password && (
          <p className="mt-1 text-sm text-knock-red">
            {errors.password.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-knock-text"
        >
          パスワード（確認） <span className="text-knock-red">*</span>
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
          className="mt-1.5 block w-full rounded-xl bg-[#F0F0F0] px-4 py-3 text-[14px] text-knock-text placeholder:text-knock-text-muted focus:outline-none focus:ring-2 focus:ring-knock-orange/30"
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-knock-red">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded-xl bg-knock-orange px-4 py-3 text-white font-medium transition-all duration-200 active:scale-[0.98] hover:bg-knock-amber hover:shadow-md focus:outline-none focus:ring-2 focus:ring-knock-orange/40 focus:ring-offset-2 disabled:opacity-50 disabled:hover:bg-knock-orange disabled:hover:shadow-none"
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2 animate-pulse">
            送信中...
          </span>
        ) : (
          "次へ"
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2: 企業情報
// ---------------------------------------------------------------------------

function Step2Form({
  companyId,
  onSuccess,
}: {
  companyId: string;
  onSuccess: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationStep2Input>({
    resolver: zodResolver(registrationStep2Schema),
  });

  const onSubmit = async (data: RegistrationStep2Input) => {
    setServerError(null);
    const result = await registerStep2(companyId, data);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    onSuccess();
  };

  const postalCode = watch("postalCode");

  useEffect(() => {
    const cleaned = (postalCode ?? "").replace(/[^0-9]/g, "");
    if (cleaned.length !== 7) return;

    let cancelled = false;
    setIsLoadingAddress(true);

    fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleaned}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.results?.[0]) return;
        const r = json.results[0];
        setValue("prefecture", r.address1, { shouldValidate: true });
        setValue("city", r.address2, { shouldValidate: true });
        setValue("streetAddress", r.address3, { shouldValidate: true });
      })
      .catch(() => {
        // 郵便番号APIエラーは無視（手動入力可能）
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAddress(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postalCode, setValue]);

  const inputClass =
    "mt-1.5 block w-full rounded-xl bg-[#F0F0F0] px-4 py-3 text-[14px] text-knock-text placeholder:text-knock-text-muted focus:outline-none focus:ring-2 focus:ring-knock-orange/30";
  const labelClass = "block text-sm font-medium text-knock-text";
  const requiredMark = <span className="text-knock-red">*</span>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-knock-red">
          {serverError}
        </div>
      )}

      <div>
        <label htmlFor="companyForm" className={labelClass}>
          会社形態 {requiredMark}
        </label>
        <select
          id="companyForm"
          {...register("companyForm")}
          className={inputClass}
        >
          <option value="">選択してください</option>
          <option value="CORPORATION">法人</option>
          <option value="INDIVIDUAL">個人事業主</option>
        </select>
        {errors.companyForm && (
          <p className="mt-1 text-sm text-knock-red">
            {errors.companyForm.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="businessName" className={labelClass}>
          会社名または屋号 {requiredMark}
        </label>
        <input
          id="businessName"
          type="text"
          {...register("businessName")}
          className={inputClass}
        />
        {errors.businessName && (
          <p className="mt-1 text-sm text-knock-red">
            {errors.businessName.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="nameKana" className={labelClass}>
          会社名または屋号（カナ） {requiredMark}
        </label>
        <input
          id="nameKana"
          type="text"
          {...register("nameKana")}
          className={inputClass}
        />
        {errors.nameKana && (
          <p className="mt-1 text-sm text-knock-red">
            {errors.nameKana.message}
          </p>
        )}
      </div>

      {/* 住所セクション */}
      <div className="space-y-4">
        <p className="text-[13px] font-bold uppercase tracking-wider text-gray-500">
          住所
        </p>

        <div>
          <label htmlFor="postalCode" className={labelClass}>
            郵便番号 {requiredMark}
          </label>
          <div className="relative">
            <input
              id="postalCode"
              type="text"
              placeholder="1234567"
              {...register("postalCode")}
              className={inputClass}
            />
            {isLoadingAddress && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-knock-border border-t-knock-orange" />
              </div>
            )}
          </div>
          {isLoadingAddress && (
            <p className="mt-1 text-xs text-knock-text-muted">
              住所を検索中...
            </p>
          )}
          {errors.postalCode && (
            <p className="mt-1 text-sm text-knock-red">
              {errors.postalCode.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prefecture" className={labelClass}>
              都道府県 {requiredMark}
            </label>
            <input
              id="prefecture"
              type="text"
              {...register("prefecture")}
              className={inputClass}
            />
            {errors.prefecture && (
              <p className="mt-1 text-sm text-knock-red">
                {errors.prefecture.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="city" className={labelClass}>
              市区町村 {requiredMark}
            </label>
            <input
              id="city"
              type="text"
              {...register("city")}
              className={inputClass}
            />
            {errors.city && (
              <p className="mt-1 text-sm text-knock-red">
                {errors.city.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="streetAddress" className={labelClass}>
            番地 {requiredMark}
          </label>
          <input
            id="streetAddress"
            type="text"
            {...register("streetAddress")}
            className={inputClass}
          />
          {errors.streetAddress && (
            <p className="mt-1 text-sm text-knock-red">
              {errors.streetAddress.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="building" className={labelClass}>
            建物名
          </label>
          <input
            id="building"
            type="text"
            {...register("building")}
            className={inputClass}
          />
        </div>
      </div>

      {/* 連絡先セクション */}
      <div className="space-y-4">
        <p className="text-[13px] font-bold uppercase tracking-wider text-gray-500">
          連絡先
        </p>

        <div>
          <label htmlFor="telNumber" className={labelClass}>
            電話番号 {requiredMark}
          </label>
          <input
            id="telNumber"
            type="text"
            {...register("telNumber")}
            className={inputClass}
          />
          {errors.telNumber && (
            <p className="mt-1 text-sm text-knock-red">
              {errors.telNumber.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="invoiceNumber" className={labelClass}>
            インボイス番号
          </label>
          <input
            id="invoiceNumber"
            type="text"
            {...register("invoiceNumber")}
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded-xl bg-knock-orange px-4 py-3 text-white font-medium transition-all duration-200 active:scale-[0.98] hover:bg-knock-amber hover:shadow-md focus:outline-none focus:ring-2 focus:ring-knock-orange/40 focus:ring-offset-2 disabled:opacity-50 disabled:hover:bg-knock-orange disabled:hover:shadow-none"
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2 animate-pulse">
            送信中...
          </span>
        ) : (
          "次へ"
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 3: 担当者情報
// ---------------------------------------------------------------------------

function Step3Form({
  companyId,
  credentials,
}: {
  companyId: string;
  credentials: { email: string; password: string };
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthError, setBirthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationStep3Input>({
    resolver: zodResolver(registrationStep3Schema),
  });

  useEffect(() => {
    if (birthYear && birthMonth && birthDay) {
      const dateOfBirth = `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`;
      setValue("dateOfBirth", dateOfBirth, { shouldValidate: true });
      setBirthError(null);
    } else {
      setValue("dateOfBirth", "", { shouldValidate: false });
    }
  }, [birthYear, birthMonth, birthDay, setValue]);

  const onSubmit = async (data: RegistrationStep3Input) => {
    if (!birthYear || !birthMonth || !birthDay) {
      setBirthError("生年月日を入力してください");
      return;
    }
    if (!/^\d{4}$/.test(birthYear)) {
      setBirthError("西暦4桁で入力してください");
      return;
    }
    if (!/^(0?[1-9]|1[0-2])$/.test(birthMonth)) {
      setBirthError("月は1〜12で入力してください");
      return;
    }
    if (!/^(0?[1-9]|[12]\d|3[01])$/.test(birthDay)) {
      setBirthError("日は1〜31で入力してください");
      return;
    }
    setServerError(null);
    setBirthError(null);
    const result = await registerStep3(companyId, data, credentials);
    if (result?.error) {
      setServerError(result.error);
    }
  };

  const inputClass =
    "mt-1.5 block w-full rounded-xl bg-[#F0F0F0] px-4 py-3 text-[14px] text-knock-text placeholder:text-knock-text-muted focus:outline-none focus:ring-2 focus:ring-knock-orange/30";
  const labelClass = "block text-sm font-medium text-knock-text";
  const requiredMark = <span className="text-knock-red">*</span>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-knock-red">
          {serverError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lastName" className={labelClass}>
            姓 {requiredMark}
          </label>
          <input
            id="lastName"
            type="text"
            {...register("lastName")}
            className={inputClass}
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-knock-red">
              {errors.lastName.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="firstName" className={labelClass}>
            名 {requiredMark}
          </label>
          <input
            id="firstName"
            type="text"
            {...register("firstName")}
            className={inputClass}
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-knock-red">
              {errors.firstName.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lastNameKana" className={labelClass}>
            姓（カナ） {requiredMark}
          </label>
          <input
            id="lastNameKana"
            type="text"
            {...register("lastNameKana")}
            className={inputClass}
          />
          {errors.lastNameKana && (
            <p className="mt-1 text-sm text-knock-red">
              {errors.lastNameKana.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="firstNameKana" className={labelClass}>
            名（カナ） {requiredMark}
          </label>
          <input
            id="firstNameKana"
            type="text"
            {...register("firstNameKana")}
            className={inputClass}
          />
          {errors.firstNameKana && (
            <p className="mt-1 text-sm text-knock-red">
              {errors.firstNameKana.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>
          生年月日 {requiredMark}
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="1990"
              maxLength={4}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-center text-knock-text-muted">年（西暦）</p>
          </div>
          <div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="1"
              maxLength={2}
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-center text-knock-text-muted">月</p>
          </div>
          <div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="1"
              maxLength={2}
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-center text-knock-text-muted">日</p>
          </div>
        </div>
        <input type="hidden" {...register("dateOfBirth")} />
        {(birthError || errors.dateOfBirth) && (
          <p className="mt-1 text-sm text-knock-red">
            {birthError || errors.dateOfBirth?.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="telPhone" className={labelClass}>
          電話番号 {requiredMark}
        </label>
        <input
          id="telPhone"
          type="text"
          {...register("telPhone")}
          className={inputClass}
        />
        {errors.telPhone && (
          <p className="mt-1 text-sm text-knock-red">
            {errors.telPhone.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded-xl bg-knock-orange px-4 py-3 text-white font-medium transition-all duration-200 active:scale-[0.98] hover:bg-knock-amber hover:shadow-md focus:outline-none focus:ring-2 focus:ring-knock-orange/40 focus:ring-offset-2 disabled:opacity-50 disabled:hover:bg-knock-orange disabled:hover:shadow-none"
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2 animate-pulse">
            送信中...
          </span>
        ) : (
          "登録する"
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 完了画面
// ---------------------------------------------------------------------------

function CompleteView() {
  return (
    <div className="space-y-6 py-4 text-center">
      {/* Success icon with radial glow */}
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
        <h2 className="text-xl font-bold text-knock-text">
          登録が完了しました
        </h2>
        <p className="text-sm text-knock-text-secondary leading-relaxed">
          ご登録いただきありがとうございます。
          <br />
          ログインページからログインしてください。
        </p>
      </div>

      <Link
        href="/login"
        className="mt-2 inline-block w-full rounded-xl bg-knock-orange px-4 py-3 text-center text-white font-medium transition-all duration-200 active:scale-[0.98] hover:bg-knock-amber hover:shadow-md focus:outline-none focus:ring-2 focus:ring-knock-orange/40 focus:ring-offset-2"
      >
        ログインページへ
      </Link>
    </div>
  );
}
