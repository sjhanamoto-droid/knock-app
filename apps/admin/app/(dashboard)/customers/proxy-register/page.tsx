"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getOccupationMasters } from "@/lib/actions/customers";
import { proxyRegisterCompany } from "@/lib/actions/proxy-registration";
import OccupationSelector from "@/components/occupation-selector";
import {
  PREFECTURES,
  emptyFields,
  matchOccupations,
  parseProxyRegistrationText,
  type ProxyRegistrationFields,
} from "@/lib/proxy-registration-parser";
import { USER_APP_LOGIN_URL } from "@/lib/proxy-registration-constants";

type MajorItem = Awaited<ReturnType<typeof getOccupationMasters>>[number];
type OccSelection = { occupationSubItemId: string; note?: string };
type CompanyKind = "ORDERER" | "CONTRACTOR";

const inputCls =
  "w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-knock-blue/20 focus:outline-none";
const selectCls = inputCls + " appearance-none";
const labelCls = "block text-[12px] font-semibold text-gray-500 mb-1.5";
const cardCls = "rounded-2xl bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)] space-y-4";

// 空欄のまま登録できない項目（ユーザー自身の新規登録と同じ）
const REQUIRED_KEYS: (keyof ProxyRegistrationFields)[] = [
  "companyForm", "businessName", "nameKana", "postalCode", "prefecture", "city", "streetAddress",
  "companyTel", "lastName", "firstName", "lastNameKana", "firstNameKana",
  "birthYear", "birthMonth", "birthDay", "personTel",
];

export default function ProxyRegisterPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"input" | "confirm" | "done">("input");
  const [type, setType] = useState<CompanyKind | "">("");
  const [loginEmail, setLoginEmail] = useState("");
  const [rawText, setRawText] = useState("");
  const [fields, setFields] = useState<ProxyRegistrationFields>(emptyFields());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [agreedInMail, setAgreedInMail] = useState<boolean | null>(null);
  const [agreementConfirmed, setAgreementConfirmed] = useState(false);
  const [masters, setMasters] = useState<MajorItem[]>([]);
  const [occSelections, setOccSelections] = useState<OccSelection[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ companyId: string; loginEmail: string; password: string } | null>(null);

  useEffect(() => {
    getOccupationMasters().then(setMasters).catch(() => setMasters([]));
  }, []);

  function set<K extends keyof ProxyRegistrationFields>(key: K, value: ProxyRegistrationFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function goConfirm(parse: boolean) {
    setError("");
    if (!type) return setError("利用形態（発注者／受注者）を選択してください");
    if (!loginEmail.trim()) return setError("ログイン用メールアドレスを入力してください");

    if (parse) {
      if (!rawText.trim()) return setError("返信メールの本文を貼り付けてください");
      const parsed = parseProxyRegistrationText(rawText);
      setFields(parsed.fields);
      setWarnings(parsed.warnings);
      setAgreedInMail(parsed.agreed);
      setAgreementConfirmed(parsed.agreed === true);
      setOccSelections(
        matchOccupations(parsed.fields.occupationsText, masters).map((id) => ({ occupationSubItemId: id }))
      );
    } else {
      setFields(emptyFields());
      setWarnings([]);
      setAgreedInMail(null);
      setAgreementConfirmed(false);
      setOccSelections([]);
    }
    setPhase("confirm");
  }

  const missing = REQUIRED_KEYS.filter((k) => !String(fields[k]).trim());
  const contractorMissing =
    type === "CONTRACTOR"
      ? [
          !fields.invoiceDigits && "インボイス登録番号",
          (!fields.bankName || !fields.bankBranchName || !fields.bankAccountType ||
            !fields.bankAccountNumber || !fields.bankAccountName) && "振込先口座",
        ].filter(Boolean)
      : [];

  async function handleRegister() {
    setError("");
    if (!type) return;
    if (!agreementConfirmed) return setError("利用規約への同意を確認してください");
    if (missing.length > 0) return setError("必須項目（*）が未入力です");

    setSubmitting(true);
    try {
      const res = await proxyRegisterCompany({
        ...fields,
        type,
        loginEmail,
        companyForm: fields.companyForm as "CORPORATION" | "INDIVIDUAL",
        occupationSubItemIds: occSelections.map((s) => s.occupationSubItemId),
      });
      if ("error" in res) {
        setError(res.error ?? "登録に失敗しました");
        return;
      }
      setResult(res);
      setPhase("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  /* ──────────── 完了: ログイン情報の表示 ──────────── */
  if (phase === "done" && result) {
    const loginText = `ログインURL：${USER_APP_LOGIN_URL}\nメールアドレス：${result.loginEmail}\n初期パスワード：${result.password}`;
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[24px] font-bold text-gray-900">代理登録が完了しました</h1>
        <p className="mt-1 text-[14px] text-gray-500">{fields.businessName} を仮登録しました。</p>

        <div className={cardCls + " mt-6"}>
          <h2 className="text-[16px] font-bold text-gray-900">ログイン情報</h2>
          <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-[14px]">
            <dt className="text-gray-500">ログインURL</dt>
            <dd className="text-gray-900 break-all">{USER_APP_LOGIN_URL}</dd>
            <dt className="text-gray-500">メールアドレス</dt>
            <dd className="font-semibold text-gray-900 break-all">{result.loginEmail}</dd>
            <dt className="text-gray-500">初期パスワード</dt>
            <dd className="font-mono font-semibold text-gray-900">{result.password}</dd>
          </dl>
          <CopyButton text={loginText} label="ログイン情報をコピー" />
          <p className="text-[12px] text-gray-500">
            初期パスワードはログイン後すぐに変更するようご案内ください。変更されるまで、顧客詳細の「ユーザー」タブにも表示されます。
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
          >
            続けて代理登録する
          </button>
          <Link
            href={`/customers/${result.companyId}`}
            className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-knock-amber"
          >
            顧客詳細を開く
          </Link>
        </div>
      </div>
    );
  }

  /* ──────────── 入力: 利用形態・メール・返信本文 ──────────── */
  if (phase === "input") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[24px] font-bold text-gray-900">代理登録（仮登録）</h1>
        <p className="mt-1 text-[14px] text-gray-500">
          代理登録メールへの返信本文を貼り付けると、登録項目を自動で読み取ります。読み取った内容は次の画面で確認・修正できます。
        </p>

        {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>}

        <div className={cardCls + " mt-6"}>
          <div>
            <label className={labelCls}>利用形態 <span className="text-red-500">*</span></label>
            <div className="flex gap-3">
              {([["ORDERER", "発注者"], ["CONTRACTOR", "受注者"]] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className={`flex-1 rounded-xl px-4 py-3 text-[14px] font-semibold transition-colors ${
                    type === v ? "bg-knock-orange text-white" : "bg-[#F0F0F0] text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>ログイン用メールアドレス <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="代理登録メールの送信先アドレス"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>返信メールの本文</label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={16}
              placeholder={"【利用規約への同意】\n■ 利用規約を確認し、同意します\n\n【会社情報】\n※事業形態：法人\n※事業者名：…\n\n（返信メールの本文をそのまま貼り付けてください）"}
              className={inputCls + " font-mono leading-relaxed"}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => goConfirm(false)}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
          >
            手入力で進む
          </button>
          <button
            type="button"
            onClick={() => goConfirm(true)}
            className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-knock-amber"
          >
            読み取って確認へ
          </button>
        </div>
      </div>
    );
  }

  /* ──────────── 確認・修正 ──────────── */
  const req = (k: keyof ProxyRegistrationFields) => (!String(fields[k]).trim() ? " ring-2 ring-red-300" : "");
  const text = (k: keyof ProxyRegistrationFields, placeholder?: string) => (
    <input
      value={String(fields[k])}
      onChange={(e) => set(k, e.target.value as never)}
      placeholder={placeholder}
      className={inputCls + (REQUIRED_KEYS.includes(k) ? req(k) : "")}
    />
  );

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => setPhase("input")} className="text-[13px] text-gray-500 hover:underline">
        ← 貼り付け画面に戻る
      </button>
      <h1 className="mt-2 text-[24px] font-bold text-gray-900">登録内容の確認</h1>
      <p className="mt-1 text-[14px] text-gray-500">
        {type === "ORDERER" ? "発注者" : "受注者"}として登録します ／ ログインID：{loginEmail}
      </p>

      {warnings.length > 0 && (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          <p className="font-semibold">読み取りで確認が必要な項目があります</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-6 space-y-5">
        <div className={cardCls}>
          <h2 className="text-[16px] font-bold text-gray-900">利用規約への同意</h2>
          <p className="text-[13px] text-gray-600">
            メールの記載：
            {agreedInMail === true ? (
              <span className="font-semibold text-emerald-600">同意あり（■）</span>
            ) : agreedInMail === false ? (
              <span className="font-semibold text-red-500">□のまま（未同意）</span>
            ) : (
              <span className="font-semibold text-gray-500">読み取れず</span>
            )}
          </p>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-800">
            <input
              type="checkbox"
              checked={agreementConfirmed}
              onChange={(e) => setAgreementConfirmed(e.target.checked)}
              className="h-4 w-4"
            />
            返信メールで利用規約への同意を確認しました <span className="text-red-500">*</span>
          </label>
        </div>

        <div className={cardCls}>
          <h2 className="text-[16px] font-bold text-gray-900">会社情報</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>事業形態 *</label>
              <select
                value={fields.companyForm}
                onChange={(e) => set("companyForm", e.target.value as ProxyRegistrationFields["companyForm"])}
                className={selectCls + req("companyForm")}
              >
                <option value="">選択</option>
                <option value="CORPORATION">法人</option>
                <option value="INDIVIDUAL">個人事業主</option>
              </select>
            </div>
            <div />
            <div><label className={labelCls}>事業者名 *</label>{text("businessName")}</div>
            <div><label className={labelCls}>フリガナ *</label>{text("nameKana")}</div>
            <div><label className={labelCls}>郵便番号 *</label>{text("postalCode", "000-0000")}</div>
            <div>
              <label className={labelCls}>都道府県 *</label>
              <select
                value={fields.prefecture}
                onChange={(e) => set("prefecture", e.target.value)}
                className={selectCls + req("prefecture")}
              >
                <option value="">選択</option>
                {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>市区町村 *</label>{text("city")}</div>
            <div><label className={labelCls}>番地 *</label>{text("streetAddress")}</div>
            <div><label className={labelCls}>建物名</label>{text("building")}</div>
            <div><label className={labelCls}>電話番号（会社） *</label>{text("companyTel")}</div>
            <div>
              <label className={labelCls}>インボイス登録番号（Tを除く13桁）</label>
              {text("invoiceDigits", "1234567890123")}
            </div>
          </div>
        </div>

        <div className={cardCls}>
          <h2 className="text-[16px] font-bold text-gray-900">担当者情報（代表者として登録）</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>姓 *</label>{text("lastName")}</div>
            <div><label className={labelCls}>名 *</label>{text("firstName")}</div>
            <div><label className={labelCls}>セイ *</label>{text("lastNameKana")}</div>
            <div><label className={labelCls}>メイ *</label>{text("firstNameKana")}</div>
            <div>
              <label className={labelCls}>生年月日（西暦） *</label>
              <div className="grid grid-cols-3 gap-2">
                {text("birthYear", "年")}
                {text("birthMonth", "月")}
                {text("birthDay", "日")}
              </div>
            </div>
            <div><label className={labelCls}>電話番号（担当者） *</label>{text("personTel")}</div>
          </div>
        </div>

        <div className={cardCls}>
          <h2 className="text-[16px] font-bold text-gray-900">振込先口座</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>銀行名</label>{text("bankName")}</div>
            <div><label className={labelCls}>支店名</label>{text("bankBranchName")}</div>
            <div>
              <label className={labelCls}>口座種別</label>
              <select
                value={fields.bankAccountType}
                onChange={(e) => set("bankAccountType", e.target.value as ProxyRegistrationFields["bankAccountType"])}
                className={selectCls}
              >
                <option value="">未選択</option>
                <option value="ORDINARY">普通</option>
                <option value="CURRENT">当座</option>
              </select>
            </div>
            <div><label className={labelCls}>口座番号</label>{text("bankAccountNumber")}</div>
            <div className="col-span-2"><label className={labelCls}>口座名義（カタカナ）</label>{text("bankAccountName")}</div>
          </div>
        </div>

        <div className={cardCls}>
          <h2 className="text-[16px] font-bold text-gray-900">対応職種</h2>
          {fields.occupationsText && (
            <p className="text-[13px] text-gray-600">
              メールの記載：<span className="font-semibold text-gray-900">{fields.occupationsText}</span>
              <span className="ml-2 text-[12px] text-gray-400">（一致した職種を自動で選択しています）</span>
            </p>
          )}
          <OccupationSelector masters={masters} value={occSelections} onChange={setOccSelections} />
        </div>
      </div>

      {contractorMissing.length > 0 && (
        <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          {contractorMissing.join("・")}が未入力です。このまま登録できますが、受注者は入力するまで案件を受注できません。
        </div>
      )}

      {error && (
        <div className="mt-5 whitespace-pre-line rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setPhase("input")}
          className="rounded-xl border border-gray-200 px-5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={handleRegister}
          disabled={submitting}
          className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-knock-amber disabled:opacity-50"
        >
          {submitting ? "登録中..." : "この内容で代理登録する"}
        </button>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-xl bg-knock-blue px-4 py-2 text-[13px] font-bold text-white hover:opacity-90"
    >
      {copied ? "コピーしました ✓" : label}
    </button>
  );
}
