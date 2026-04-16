"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getVerificationStatus } from "@/lib/actions/verification";

/**
 * KYC未完了バナー: registrationStepが残っている場合に表示
 * 登録ステップに応じてリンク先を変更
 */
export default function KycPrompt() {
  const [step, setStep] = useState<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    getVerificationStatus()
      .then((status) => {
        if (!status.isKycComplete && status.registrationStep != null) {
          setStep(status.registrationStep);
          setShow(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!show) return null;

  const stepLabel =
    step === 1
      ? "会社情報の登録"
      : step === 2
        ? "個人情報の登録"
        : "登録の完了";

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-[13px] font-bold text-amber-800">
        登録が完了していません
      </p>
      <p className="mt-1 text-[12px] text-amber-700">
        案件への応募や発注を行うには、{stepLabel}が必要です。
      </p>
      <Link
        href="/settings/profile"
        className="mt-2 inline-block rounded-lg bg-amber-600 px-4 py-2 text-[12px] font-bold text-white"
      >
        登録を続ける
      </Link>
    </div>
  );
}
