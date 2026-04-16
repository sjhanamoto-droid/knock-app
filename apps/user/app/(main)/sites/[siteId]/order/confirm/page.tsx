"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSite } from "@/lib/actions/sites";
import { getContractor } from "@/lib/actions/contractors";
import { createOrderRequest } from "@/lib/actions/orders";
import { sendConnectionRequest } from "@/lib/actions/invitations";
import { ConfirmDialog, AlertDialog, useToast } from "@knock/ui";
import { useMode } from "@/lib/hooks/use-mode";

type SiteData = NonNullable<Awaited<ReturnType<typeof getSite>>>;
type ContractorData = NonNullable<Awaited<ReturnType<typeof getContractor>>>;

const cardClass =
  "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";
const labelClass = "text-[12px] text-knock-text-secondary";
const valueClass = "text-[14px] text-knock-text";

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "未設定";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function fmtAmount(n: number | bigint | null | undefined): string {
  if (n == null) return "-";
  return `${Number(n).toLocaleString("ja-JP")}円`;
}

export default function OrderConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { accentColor } = useMode();

  const siteId = params.siteId as string;
  const companyId = searchParams.get("companyId");

  const [site, setSite] = useState<SiteData | null>(null);
  const [contractor, setContractor] = useState<ContractorData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [localInvitationStatus, setLocalInvitationStatus] = useState<"none" | "sent" | "received" | "connected">("none");
  const [successMessage, setSuccessMessage] = useState("");
  const [redirectPath, setRedirectPath] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    Promise.all([getSite(siteId), getContractor(companyId)])
      .then(([siteData, contractorData]) => {
        setSite(siteData);
        setContractor(contractorData);
        if (contractorData) {
          setLocalInvitationStatus(contractorData.invitationStatus);
        }
        // 既に発注済みの場合はフラグを立てる
        if (siteData && siteData.status !== "NOT_ORDERED") {
          setSubmitted(true);
        }
      })
      .finally(() => setLoading(false));
  }, [siteId, companyId]);

  async function handleSubmit() {
    if (!site || !contractor) return;
    setSubmitting(true);
    setError("");
    try {
      await createOrderRequest({
        factoryFloorId: siteId,
        workCompanyId: contractor.id,
        message: message.trim() || undefined,
      });
      setSubmitted(true);
      setShowConfirm(false);
      setRedirectPath(`/sites/${siteId}`);
      setSuccessMessage("発注依頼を送信しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  async function handleSendConnectionRequest() {
    if (!companyId) return;
    setSendingRequest(true);
    try {
      await sendConnectionRequest(companyId);
      setLocalInvitationStatus("sent");
      setSuccessMessage("つながり申請を送信しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSendingRequest(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!site || !contractor || !companyId) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <span className="text-[14px] text-gray-400">
          データが見つかりません
        </span>
        <button
          onClick={() => router.push(`/sites/${siteId}/order`)}
          className="text-[13px] font-semibold text-knock-blue"
        >
          戻る
        </button>
      </div>
    );
  }

  // 既に発注済みの場合（成功ダイアログ表示中は除く）
  if (submitted && !successMessage) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <span className="text-[14px] text-knock-text-secondary">この現場は既に発注依頼済みです</span>
        <button
          onClick={() => router.replace(`/sites/${siteId}`)}
          className="rounded-xl px-6 py-2.5 text-[14px] font-bold text-white bg-blue-500"
        >
          現場へ移動
        </button>
      </div>
    );
  }

  // 明細合計
  const totalAmount =
    site.priceDetails?.reduce(
      (sum, d) => sum + Math.ceil((d.quantity ?? 0) * (Number(d.priceUnit) || 0)),
      0
    ) ?? 0;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push(`/sites/${siteId}/order`)}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M13 4L7 10L13 16"
                stroke="#1A1A1A"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">発注内容確認</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-3 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
            {error}
          </div>
        )}

        {/* 未接続ガード */}
        {localInvitationStatus !== "connected" ? (
          <>
            {/* 受注者情報 */}
            <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
              <div className="flex items-start gap-3">
                {contractor.logo ? (
                  <img
                    src={contractor.logo}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[14px] font-bold text-gray-400">
                    {contractor.name?.charAt(0) ?? "?"}
                  </div>
                )}
                <div>
                  <p className="text-[15px] font-bold text-knock-text">
                    {contractor.name}
                  </p>
                  {(contractor.prefecture || contractor.city) && (
                    <p className="mt-0.5 text-[12px] text-knock-text-secondary">
                      {contractor.prefecture}
                      {contractor.city}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
              <div className="mb-2 text-[24px]">
                {localInvitationStatus === "sent" ? "⏳" : "🔗"}
              </div>
              <p className="mb-1 text-[15px] font-bold text-knock-text">
                {localInvitationStatus === "sent"
                  ? "つながり承認待ちです"
                  : "まだつながっていません"}
              </p>
              <p className="mb-4 text-[13px] text-knock-text-secondary">
                {localInvitationStatus === "sent"
                  ? "相手の承認をお待ちください。承認後に発注依頼を送信できます。"
                  : "発注依頼を送るには、先につながり申請を送信してください。"}
              </p>
              {localInvitationStatus === "none" && (
                <button
                  onClick={handleSendConnectionRequest}
                  disabled={sendingRequest}
                  className="rounded-xl bg-blue-500 px-6 py-3 text-[14px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
                >
                  {sendingRequest ? "送信中..." : "つながり申請を送る"}
                </button>
              )}
            </div>

            <button
              onClick={() => router.push(`/sites/${siteId}/order`)}
              className="text-center text-[13px] font-semibold text-knock-blue"
            >
              受注者選択に戻る
            </button>
          </>
        ) : (
          <>
            {/* 現場情報 */}
            <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-knock-text-secondary">
                現場情報
              </p>
              <p className="text-[15px] font-bold text-knock-text">{site.name}</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {site.address && (
                  <div>
                    <span className={labelClass}>住所</span>
                    <p className={valueClass}>{site.address}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className={labelClass}>工期開始</span>
                    <p className={valueClass}>{fmtDate(site.startDayRequest)}</p>
                  </div>
                  <div>
                    <span className={labelClass}>工期終了</span>
                    <p className={valueClass}>{fmtDate(site.endDayRequest)}</p>
                  </div>
                </div>
                {totalAmount > 0 && (
                  <div>
                    <span className={labelClass}>発注金額</span>
                    <div className="mt-1 flex flex-col gap-0.5">
                      <div className="flex justify-between text-[13px]">
                        <span className="text-knock-text-secondary">小計</span>
                        <span className="text-knock-text">{fmtAmount(totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-[13px]">
                        <span className="text-knock-text-secondary">消費税（10%）</span>
                        <span className="text-knock-text">{fmtAmount(Math.floor(totalAmount * 0.1))}</span>
                      </div>
                      <div className="mt-0.5 flex justify-between border-t border-gray-100 pt-1">
                        <span className="text-[13px] font-bold text-knock-text">合計金額（税込）</span>
                        <span className="text-[15px] font-bold text-blue-600">
                          {fmtAmount(totalAmount + Math.floor(totalAmount * 0.1))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 受注者情報 */}
            <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-knock-text-secondary">
                発注先
              </p>
              <div className="flex items-start gap-3">
                {contractor.logo ? (
                  <img
                    src={contractor.logo}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[14px] font-bold text-gray-400">
                    {contractor.name?.charAt(0) ?? "?"}
                  </div>
                )}
                <div>
                  <p className="text-[15px] font-bold text-knock-text">
                    {contractor.name}
                  </p>
                  {(contractor.prefecture || contractor.city) && (
                    <p className="mt-0.5 text-[12px] text-knock-text-secondary">
                      {contractor.prefecture}
                      {contractor.city}
                      {contractor.streetAddress}
                    </p>
                  )}
                  {contractor.occupations.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {contractor.occupations.map((occ) => (
                        <span
                          key={occ.id}
                          className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600"
                        >
                          {occ.occupationSubItem?.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* メッセージ */}
            <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-knock-text-secondary">
                メッセージ（任意）
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="発注に関するメッセージを入力..."
                className="w-full rounded-lg bg-[#F0F0F0] border-none px-3 py-2.5 text-[14px] text-knock-text placeholder:text-gray-400 focus:outline-none"
              />
            </div>

            {/* 送信ボタン */}
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={submitting}
              className="rounded-xl bg-blue-500 py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? "送信中..." : "発注依頼を送信"}
            </button>
          </>
        )}
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="発注依頼を送信"
        message={`${contractor.name} に発注依頼を送信します。よろしいですか？`}
        confirmLabel={submitting ? "送信中..." : "送信する"}
        cancelLabel="キャンセル"
        variant="primary"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => {
          setSuccessMessage("");
          if (redirectPath) {
            router.replace(redirectPath);
          }
        }}
        title="完了"
        message={successMessage}
      />
    </div>
  );
}
