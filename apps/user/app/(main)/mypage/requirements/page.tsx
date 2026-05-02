"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  checkContractorRequirements,
  saveContractorRequirements,
  type RequirementCheck,
} from "@/lib/actions/contractor-requirements";

const inputStyle = {
  backgroundColor: "#F0F0F0",
  borderRadius: "12px",
  border: "none",
  color: "#1A2340",
};
const inputClass = "w-full px-4 py-3.5 text-[14px] outline-none";
const labelClass = "text-[13px] font-semibold mb-1.5 block text-[#1A2340]";
const cardClass = "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";

const WORK_ELIGIBILITY_OPTIONS = [
  { value: "JAPANESE_NATIONAL", label: "日本国籍" },
  { value: "PERMANENT_RESIDENT", label: "外国籍（永住者・定住者等）" },
  { value: "SPECIFIED_SKILLED", label: "外国籍（特定技能・建設分野）" },
  { value: "WORK_VISA", label: "外国籍（技人国ビザ・高度専門職）" },
  { value: "OTHER", label: "上記に該当しない" },
];

const CONSTRUCTION_PERMIT_OPTIONS = [
  { value: "NONE", label: "取得していない" },
  { value: "MLIT_GENERAL", label: "国土交通大臣許可（一般）" },
  { value: "MLIT_SPECIAL", label: "国土交通大臣許可（特定）" },
  { value: "GOVERNOR_GENERAL", label: "都道府県知事許可（一般）" },
  { value: "GOVERNOR_SPECIAL", label: "都道府県知事許可（特定）" },
];

const INSURANCE_TYPE_OPTIONS = [
  { value: "FIRE", label: "火災保険" },
  { value: "LIABILITY", label: "賠償責任保険" },
  { value: "WORKERS_ACCIDENT", label: "労働災害補償保険" },
  { value: "VEHICLE", label: "自動車保険" },
  { value: "OTHER", label: "その他" },
];

export default function RequirementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/mypage";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState<RequirementCheck | null>(null);

  // Form state
  const [workEligibility, setWorkEligibility] = useState("");
  const [workersCompInsurance, setWorkersCompInsurance] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [constructionPermit, setConstructionPermit] = useState("");
  const [socialInsurance, setSocialInsurance] = useState<string>("");
  const [bankName, setBankName] = useState("");
  const [bankBranchName, setBankBranchName] = useState("");
  const [bankAccountType, setBankAccountType] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [insuranceTypes, setInsuranceTypes] = useState<string[]>([]);

  useEffect(() => {
    checkContractorRequirements().then((result) => {
      setCheck(result);
      const d = result.data;
      if (d.workEligibility) setWorkEligibility(d.workEligibility);
      if (d.workersCompInsurance != null) setWorkersCompInsurance(d.workersCompInsurance ? "true" : "false");
      if (d.invoiceNumber) setInvoiceNumber(d.invoiceNumber);
      if (d.constructionPermit) setConstructionPermit(d.constructionPermit);
      if (d.socialInsurance != null) setSocialInsurance(d.socialInsurance ? "true" : "false");
      if (d.bankName) setBankName(d.bankName);
      if (d.bankBranchName) setBankBranchName(d.bankBranchName);
      if (d.bankAccountType) setBankAccountType(d.bankAccountType);
      if (d.bankAccountNumber) setBankAccountNumber(d.bankAccountNumber);
      if (d.bankAccountName) setBankAccountName(d.bankAccountName);
      if (d.insuranceTypes.length > 0) setInsuranceTypes(d.insuranceTypes);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    // バリデーション
    if (!workEligibility) return alert("就労資格を選択してください");
    if (workersCompInsurance === "") return alert("労災保険の加入状況を選択してください");
    if (!invoiceNumber) return alert("インボイス番号を入力してください");
    if (!constructionPermit) return alert("建設業許可証の状況を選択してください");
    if (socialInsurance === "") return alert("社会保険の加入状況を選択してください");
    if (!bankName || !bankBranchName || !bankAccountType || !bankAccountNumber || !bankAccountName) {
      return alert("振込先口座情報をすべて入力してください");
    }

    setSaving(true);
    try {
      await saveContractorRequirements({
        workEligibility,
        workersCompInsurance: workersCompInsurance === "true",
        invoiceNumber,
        constructionPermit,
        socialInsurance: socialInsurance === "true",
        bankName,
        bankBranchName,
        bankAccountType,
        bankAccountNumber,
        bankAccountName,
        insuranceTypes,
      });
      alert("保存しました");
      router.push(returnTo);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-32">
      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white px-4 py-3 text-center shadow-sm">
        <button
          onClick={() => router.back()}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-1"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="#1A2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-[16px] font-bold text-[#1A2340]">必要情報の入力</h1>
      </div>

      {/* 不足情報バナー */}
      {check && check.missing.length > 0 && (
        <div className="mx-4 mt-4 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3">
          <p className="text-[13px] font-bold text-amber-800 mb-1">以下の情報が不足しています</p>
          <ul className="text-[12px] text-amber-700">
            {check.missing.map((m) => (
              <li key={m}>・{m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4 p-4">
        {/* 就労資格 */}
        <div className={cardClass}>
          <label className={labelClass}>就労資格 <span className="text-red-500">*</span></label>
          <select
            value={workEligibility}
            onChange={(e) => setWorkEligibility(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">選択してください</option>
            {WORK_ELIGIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 労災保険 */}
        <div className={cardClass}>
          <label className={labelClass}>労災保険の加入 <span className="text-red-500">*</span></label>
          <div className="flex gap-3">
            {[
              { value: "true", label: "加入している" },
              { value: "false", label: "加入していない" },
            ].map((o) => (
              <label
                key={o.value}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 cursor-pointer text-[14px] font-semibold transition-all"
                style={{
                  backgroundColor: workersCompInsurance === o.value ? "rgba(245,166,35,0.1)" : "#F0F0F0",
                  border: workersCompInsurance === o.value ? "2px solid #F5A623" : "2px solid transparent",
                }}
              >
                <input
                  type="radio"
                  value={o.value}
                  checked={workersCompInsurance === o.value}
                  onChange={(e) => setWorkersCompInsurance(e.target.value)}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        {/* インボイス番号 */}
        <div className={cardClass}>
          <label className={labelClass}>インボイス番号 <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="T1234567890123"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* 建設業許可証 */}
        <div className={cardClass}>
          <label className={labelClass}>建設業許可証 <span className="text-red-500">*</span></label>
          <select
            value={constructionPermit}
            onChange={(e) => setConstructionPermit(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">選択してください</option>
            {CONSTRUCTION_PERMIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 社会保険 */}
        <div className={cardClass}>
          <label className={labelClass}>社会保険の加入 <span className="text-red-500">*</span></label>
          <div className="flex gap-3">
            {[
              { value: "true", label: "加入している" },
              { value: "false", label: "加入していない" },
            ].map((o) => (
              <label
                key={o.value}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 cursor-pointer text-[14px] font-semibold transition-all"
                style={{
                  backgroundColor: socialInsurance === o.value ? "rgba(245,166,35,0.1)" : "#F0F0F0",
                  border: socialInsurance === o.value ? "2px solid #F5A623" : "2px solid transparent",
                }}
              >
                <input
                  type="radio"
                  value={o.value}
                  checked={socialInsurance === o.value}
                  onChange={(e) => setSocialInsurance(e.target.value)}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        {/* その他保険 */}
        <div className={cardClass}>
          <label className={labelClass}>その他保険（該当するものを選択）</label>
          <div className="flex flex-wrap gap-2">
            {INSURANCE_TYPE_OPTIONS.map((o) => {
              const checked = insuranceTypes.includes(o.value);
              return (
                <label
                  key={o.value}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer text-[13px] font-medium transition-all"
                  style={{
                    backgroundColor: checked ? "rgba(59,130,246,0.1)" : "#F0F0F0",
                    border: checked ? "2px solid #3B82F6" : "2px solid transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setInsuranceTypes((prev) =>
                        checked ? prev.filter((t) => t !== o.value) : [...prev, o.value]
                      );
                    }}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* 振込先口座 */}
        <div className={cardClass}>
          <p className="text-[14px] font-bold text-[#1A2340] mb-3">振込先口座 <span className="text-red-500">*</span></p>

          <div className="space-y-3">
            <div>
              <label className={labelClass}>銀行名</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="○○銀行"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass}>支店名</label>
              <input
                type="text"
                value={bankBranchName}
                onChange={(e) => setBankBranchName(e.target.value)}
                placeholder="○○支店"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass}>口座種別</label>
              <div className="flex gap-3">
                {[
                  { value: "ORDINARY", label: "普通" },
                  { value: "CURRENT", label: "当座" },
                ].map((o) => (
                  <label
                    key={o.value}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 cursor-pointer text-[14px] font-semibold transition-all"
                    style={{
                      backgroundColor: bankAccountType === o.value ? "rgba(245,166,35,0.1)" : "#F0F0F0",
                      border: bankAccountType === o.value ? "2px solid #F5A623" : "2px solid transparent",
                    }}
                  >
                    <input
                      type="radio"
                      value={o.value}
                      checked={bankAccountType === o.value}
                      onChange={(e) => setBankAccountType(e.target.value)}
                      className="sr-only"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>口座番号</label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="1234567"
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass}>口座名義</label>
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="カ）ノック"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 保存ボタン */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+60px)] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-2xl py-4 text-[15px] font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: "#F5A623" }}
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </div>
  );
}
