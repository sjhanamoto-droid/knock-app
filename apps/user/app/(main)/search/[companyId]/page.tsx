"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getContractor } from "@/lib/actions/contractors";
import {
  sendConnectionRequest,
  approveInvitation,
  rejectInvitation,
} from "@/lib/actions/invitations";
import { ConfirmDialog, useToast } from "@knock/ui";

type ContractorData = NonNullable<Awaited<ReturnType<typeof getContractor>>>;

const cardClass =
  "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";
const sectionTitleClass =
  "mb-2 text-[12px] font-bold uppercase tracking-wider text-knock-text-secondary";
const labelClass = "text-[11px] text-knock-text-secondary";
const valueClass = "text-[14px] text-knock-text";
const emptyClass = "text-[13px] text-gray-300";

const AVAILABILITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  AVAILABLE: { bg: "bg-green-500", text: "text-green-700", label: "空き" },
  BUSY: { bg: "bg-red-400", text: "text-red-600", label: "予定あり" },
  NEGOTIABLE: { bg: "bg-amber-400", text: "text-amber-600", label: "応相談" },
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = (score / 5) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[12px] text-knock-text-secondary">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-amber-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-[12px] font-semibold text-knock-text">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export default function ContractorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const companyId = params.companyId as string;

  const [contractor, setContractor] = useState<ContractorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [invitedId, setInvitedId] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<
    "none" | "sent" | "received" | "connected"
  >("none");

  useEffect(() => {
    getContractor(companyId)
      .then((data) => {
        setContractor(data);
        if (data) {
          setInviteStatus(data.invitationStatus);
          setInvitedId(data.invitedId);
        }
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  async function handleSendRequest() {
    setSending(true);
    try {
      await sendConnectionRequest(companyId);
      setInviteStatus("sent");
      toast("連絡リクエストを送信しました");
      setShowConfirm(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  }

  async function handleApprove() {
    if (!invitedId) return;
    setProcessing(true);
    try {
      const chatRoom = await approveInvitation(invitedId);
      toast("つながりが成立しました");
      router.push(`/chat/${chatRoom.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "エラーが発生しました");
      setProcessing(false);
      setShowApproveConfirm(false);
    }
  }

  async function handleReject() {
    if (!invitedId) return;
    setProcessing(true);
    try {
      await rejectInvitation(invitedId);
      toast("リクエストを拒否しました");
      setInviteStatus("none");
      setInvitedId(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setProcessing(false);
      setShowRejectConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <span className="text-[14px] text-gray-400">
          会社情報が見つかりません
        </span>
        <button
          onClick={() => router.back()}
          className="text-[13px] font-semibold text-knock-blue"
        >
          戻る
        </button>
      </div>
    );
  }

  // 工種を大カテゴリでグループ化
  const occupationGroups = new Map<
    string,
    { majorName: string; items: string[] }
  >();
  for (const occ of contractor.occupations) {
    const major = occ.occupationSubItem?.occupationMajorItem;
    if (!major) continue;
    if (!occupationGroups.has(major.id)) {
      occupationGroups.set(major.id, { majorName: major.name, items: [] });
    }
    occupationGroups
      .get(major.id)!
      .items.push(occ.occupationSubItem?.name ?? "");
  }

  const hasBottomButton = inviteStatus !== "connected" || !!contractor.chatRoomId;
  const ts = contractor.trustScore;
  const formLabel = contractor.companyForm === "CORPORATION" ? "法人" : contractor.companyForm === "INDIVIDUAL" ? "個人事業主" : null;

  // 空きスケジュールを週ごとにグループ化
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="flex flex-col">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
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
          <h1 className="truncate text-[17px] font-bold text-knock-text">
            {contractor.name}
          </h1>
        </div>
      </header>

      <div
        className={`flex flex-col gap-3 px-4 pt-3 ${hasBottomButton ? "pb-24" : "pb-8"}`}
      >
        {/* === プロフィールカード === */}
        <div className={cardClass}>
          <div className="flex items-start gap-4">
            {contractor.logo ? (
              <img
                src={contractor.logo}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-[20px] font-bold text-gray-400">
                {contractor.name?.charAt(0) ?? "?"}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[17px] font-bold text-knock-text">
                  {contractor.name}
                </h2>
              </div>

              {/* ステータスバッジ */}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {inviteStatus === "connected" && (
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-medium text-green-600">
                    つながり済
                  </span>
                )}
                {inviteStatus === "sent" && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-600">
                    リクエスト中
                  </span>
                )}
                {inviteStatus === "received" && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600">
                    リクエスト受信
                  </span>
                )}
                {contractor.isAcceptingWork && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600">
                    受付中
                  </span>
                )}
                {!contractor.isAcceptingWork && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-500">
                    受付停止中
                  </span>
                )}
                {formLabel && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                    {formLabel}
                  </span>
                )}
                {contractor.yearsOfExperience != null && (
                  <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-medium text-purple-600">
                    経験{contractor.yearsOfExperience}年
                  </span>
                )}
              </div>

              {/* 住所 */}
              <p className="mt-2 text-[13px] text-knock-text-secondary">
                {contractor.prefecture || contractor.city || contractor.streetAddress
                  ? `${contractor.prefecture ?? ""}${contractor.city ?? ""}${contractor.streetAddress ?? ""}`
                  : <span className={emptyClass}>住所未登録</span>}
              </p>
            </div>
          </div>

          {/* 連絡先 */}
          <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-knock-text-secondary">
                <path d="M5.5 1.5H3C2.17 1.5 1.5 2.17 1.5 3C1.5 8.25 5.75 12.5 11 12.5C11.83 12.5 12.5 11.83 12.5 11V9.5L10 8.5L8.5 10C7.07 9.27 5.73 7.93 5 6.5L6.5 5L5.5 2.5V1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {contractor.telNumber ? (
                <a href={`tel:${contractor.telNumber}`} className="text-[13px] text-blue-500">
                  {contractor.telNumber}
                </a>
              ) : (
                <span className={emptyClass}>電話番号未登録</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-knock-text-secondary">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M1.5 7H12.5M7 1.5C8.5 3 9.5 5 9.5 7C9.5 9 8.5 11 7 12.5M7 1.5C5.5 3 4.5 5 4.5 7C4.5 9 5.5 11 7 12.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              {contractor.hpUrl ? (
                <a href={contractor.hpUrl} target="_blank" rel="noopener noreferrer" className="truncate text-[13px] text-blue-500">
                  {contractor.hpUrl}
                </a>
              ) : (
                <span className={emptyClass}>HP未登録</span>
              )}
            </div>
          </div>
        </div>

        {/* === 自己紹介 === */}
        <div className={cardClass}>
          <p className={sectionTitleClass}>自己紹介</p>
          {contractor.selfIntro ? (
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-knock-text">
              {contractor.selfIntro}
            </p>
          ) : (
            <p className={emptyClass}>未登録</p>
          )}
        </div>

        {/* === 信用スコア === */}
        <div className={cardClass}>
          <p className={sectionTitleClass}>信用スコア</p>
          {ts && ts.overallScore > 0 ? (
            <>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                    <span className="text-[22px] font-bold text-amber-500">
                      {ts.overallScore.toFixed(1)}
                    </span>
                  </div>
                  <span className="mt-1 text-[10px] text-knock-text-secondary">総合</span>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <ScoreBar label="技術力" score={ts.technicalAvg} />
                  <ScoreBar label="コミュニケーション" score={ts.communicationAvg} />
                  <ScoreBar label="信頼性" score={ts.reliabilityAvg} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                <div className="text-center">
                  <p className="text-[16px] font-bold text-knock-text">{ts.totalTransactions}</p>
                  <p className={labelClass}>取引実績</p>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-bold text-knock-text">{ts.onTimeRate.toFixed(0)}%</p>
                  <p className={labelClass}>納期遵守率</p>
                </div>
                <div className="text-center">
                  <p className="text-[16px] font-bold text-knock-text">{ts.repeatRate.toFixed(0)}%</p>
                  <p className={labelClass}>リピート率</p>
                </div>
              </div>
              {contractor.evaluationCount > 0 && (
                <p className="mt-2 text-right text-[11px] text-knock-text-muted">
                  {contractor.evaluationCount}件の評価
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50">
                <span className="text-[16px] font-bold text-gray-300">--</span>
              </div>
              <span className={emptyClass}>取引実績がありません</span>
            </div>
          )}
        </div>

        {/* === 空きスケジュール === */}
        <div className={cardClass}>
          <p className={sectionTitleClass}>空きスケジュール（30日間）</p>
          {contractor.isAvailabilityPublic && contractor.availabilitySlots.length > 0 ? (
            <>
              <div className="mb-3 flex gap-3">
                {Object.entries(AVAILABILITY_COLORS).map(([key, v]) => (
                  <div key={key} className="flex items-center gap-1">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${v.bg}`} />
                    <span className="text-[10px] text-knock-text-secondary">{v.label}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {contractor.availabilitySlots.map((slot) => {
                  const d = new Date(slot.date);
                  const day = d.getDate();
                  const dow = d.getDay();
                  const colors = AVAILABILITY_COLORS[slot.status] ?? AVAILABILITY_COLORS.AVAILABLE;
                  return (
                    <div
                      key={slot.date}
                      className="flex flex-col items-center rounded-lg py-1.5"
                    >
                      <span className={`text-[9px] ${dow === 0 ? "text-red-400" : dow === 6 ? "text-blue-400" : "text-knock-text-muted"}`}>
                        {["日", "月", "火", "水", "木", "金", "土"][dow]}
                      </span>
                      <span className="text-[11px] font-medium text-knock-text">{day}</span>
                      <span className={`mt-0.5 h-2 w-2 rounded-full ${colors.bg}`} />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className={emptyClass}>
              {contractor.isAvailabilityPublic ? "スケジュール未登録" : "非公開"}
            </p>
          )}
        </div>

        {/* === 対応工種 === */}
        <div className={cardClass}>
          <p className={sectionTitleClass}>対応工種</p>
          {occupationGroups.size > 0 ? (
            <div className="flex flex-col gap-3">
              {Array.from(occupationGroups.entries()).map(
                ([majorId, group]) => (
                  <div key={majorId}>
                    <p className="mb-1 text-[12px] font-semibold text-knock-text">
                      {group.majorName}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.items.map((name, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className={emptyClass}>未登録</p>
          )}
        </div>

        {/* === 対応エリア === */}
        <div className={cardClass}>
          <p className={sectionTitleClass}>対応エリア</p>
          {contractor.areas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {contractor.areas.map((a) => (
                <span
                  key={a.id}
                  className="rounded-full bg-amber-50 px-3 py-1 text-[12px] font-medium text-amber-600"
                >
                  {a.area?.name}
                </span>
              ))}
            </div>
          ) : (
            <p className={emptyClass}>未登録</p>
          )}
        </div>

        {/* === 保険・保証 === */}
        <div className={cardClass}>
          <p className={sectionTitleClass}>保険・保証</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "fire", has: contractor.fireInsurance, label: "火災保険" },
              { key: "social", has: contractor.socialInsurance, label: "社会保険" },
              { key: "other", has: contractor.otherInsurance, label: "その他保険" },
            ].map((ins) => (
              <div
                key={ins.key}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${
                  ins.has ? "bg-green-50" : "bg-gray-50"
                }`}
              >
                {ins.has ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5.5 7L6.5 8L8.5 6" stroke="#16a34a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="7" cy="7" r="5.5" stroke="#16a34a" strokeWidth="1.2"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="#d1d5db" strokeWidth="1.2"/>
                    <path d="M5 7H9" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                )}
                <span className={`text-[12px] font-medium ${ins.has ? "text-green-700" : "text-gray-400"}`}>
                  {ins.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 固定ボタン */}
      {inviteStatus === "none" && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+60px)] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-4 text-[15px] font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
          >
            連絡を取る
          </button>
        </div>
      )}

      {inviteStatus === "sent" && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+60px)] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4">
          <button
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-300 py-4 text-[15px] font-bold text-white"
          >
            リクエスト送信済
          </button>
        </div>
      )}

      {inviteStatus === "received" && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+60px)] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4">
          <div className="flex gap-3">
            <button
              onClick={() => setShowRejectConfirm(true)}
              disabled={processing}
              className="flex-1 rounded-2xl border border-gray-300 bg-white py-4 text-[15px] font-bold text-knock-text transition-all active:scale-[0.98] disabled:opacity-50"
            >
              拒否する
            </button>
            <button
              onClick={() => setShowApproveConfirm(true)}
              disabled={processing}
              className="flex-1 rounded-2xl bg-blue-500 py-4 text-[15px] font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              承認する
            </button>
          </div>
        </div>
      )}

      {inviteStatus === "connected" && contractor.chatRoomId && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+60px)] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4">
          <button
            onClick={() => router.push(`/chat/${contractor.chatRoomId}`)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-4 text-[15px] font-bold text-white shadow-lg transition-all active:scale-[0.98]"
          >
            チャットを開く
          </button>
        </div>
      )}

      {/* 送信確認ダイアログ */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSendRequest}
        title="連絡リクエスト"
        message={`${contractor.name} に連絡リクエストを送信します。相手が承認するとチャットが開始されます。`}
        confirmLabel={sending ? "送信中..." : "送信する"}
        cancelLabel="キャンセル"
        variant="primary"
      />

      {/* 承認ダイアログ */}
      <ConfirmDialog
        open={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={handleApprove}
        title="リクエストを承認"
        message={`${contractor.name} とのつながりを承認します。チャットルームが作成されます。`}
        confirmLabel={processing ? "処理中..." : "承認する"}
        cancelLabel="キャンセル"
        variant="primary"
      />

      {/* 拒否ダイアログ */}
      <ConfirmDialog
        open={showRejectConfirm}
        onClose={() => setShowRejectConfirm(false)}
        onConfirm={handleReject}
        title="リクエストを拒否"
        message={`${contractor.name} からの連絡リクエストを拒否しますか？`}
        confirmLabel={processing ? "処理中..." : "拒否する"}
        cancelLabel="キャンセル"
        variant="danger"
      />
    </div>
  );
}
