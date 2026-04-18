"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getInvitation,
  approveInvitation,
  rejectInvitation,
} from "@/lib/actions/invitations";
import { ConfirmDialog, useToast } from "@knock/ui";
import { useMode } from "@/lib/hooks/use-mode";

type InvitationData = NonNullable<Awaited<ReturnType<typeof getInvitation>>>;

const cardClass =
  "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";
const sectionTitleClass =
  "mb-2 text-[11px] font-bold uppercase tracking-wider text-knock-text-secondary";

export default function InvitationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { accentColor } = useMode();
  const invitedId = params.invitedId as string;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  useEffect(() => {
    getInvitation(invitedId)
      .then((data) => setInvitation(data))
      .finally(() => setLoading(false));
  }, [invitedId]);

  async function handleApprove() {
    setProcessing(true);
    try {
      const chatRoom = await approveInvitation(invitedId);
      toast("つながりが成立しました");
      router.replace(`/chat/${chatRoom.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "エラーが発生しました");
      setProcessing(false);
      setShowApproveConfirm(false);
    }
  }

  async function handleReject() {
    setProcessing(true);
    try {
      await rejectInvitation(invitedId);
      toast("リクエストを拒否しました");
      router.replace("/notifications");
    } catch (err) {
      toast(err instanceof Error ? err.message : "エラーが発生しました");
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

  if (!invitation) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <span className="text-[14px] text-gray-400">
          招待が見つかりません
        </span>
        <button
          onClick={() => router.push("/notifications")}
          className="text-[13px] font-semibold text-knock-blue"
        >
          通知一覧に戻る
        </button>
      </div>
    );
  }

  const company = invitation.inviteCompany;

  // 工種をグループ化
  const occupationGroups = new Map<
    string,
    { majorName: string; items: string[] }
  >();
  for (const occ of company.occupations) {
    const major = occ.occupationSubItem?.occupationMajorItem;
    if (!major) continue;
    if (!occupationGroups.has(major.id)) {
      occupationGroups.set(major.id, { majorName: major.name, items: [] });
    }
    occupationGroups
      .get(major.id)!
      .items.push(occ.occupationSubItem?.name ?? "");
  }

  return (
    <div className="flex flex-col">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push("/notifications")}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">連絡リクエスト</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none"><path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-3 bg-[#F5F5F5] px-4 pt-3 pb-24">
        {/* 説明 */}
        <div className="rounded-xl bg-blue-50 px-4 py-3">
          <p className="text-[13px] text-blue-700">
            以下の企業から連絡リクエストが届いています。承認するとチャットが開始されます。
          </p>
        </div>

        {/* 会社プロフィール */}
        <Link
          href={`/search/${company.id}`}
          className={`${cardClass} block transition-colors active:bg-gray-50`}
        >
          <div className="flex items-start gap-4">
            {company.logo ? (
              <img
                src={company.logo}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-[20px] font-bold text-gray-400">
                {company.name?.charAt(0) ?? "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-bold text-knock-text">
                {company.name}
              </h2>
              {company.companyForm && (
                <span className="mt-1 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-knock-text-secondary">
                  {company.companyForm === "CORPORATION" ? "法人" : "個人事業主"}
                </span>
              )}
              {(company.prefecture ||
                company.city ||
                company.streetAddress) && (
                <p className="mt-1 text-[13px] text-knock-text-secondary">
                  {company.prefecture}
                  {company.city}
                  {company.streetAddress}
                </p>
              )}
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="mt-5 shrink-0"
            >
              <path
                d="M6 4L10 8L6 12"
                stroke="#9CA3AF"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="mt-2 flex items-center justify-end gap-1">
            <span className="text-[12px] font-medium text-blue-500">詳細を見る</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 3L7.5 6L4.5 9" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </Link>

        {/* 紹介文 */}
        {company.note && (
          <div className={cardClass}>
            <p className={sectionTitleClass}>紹介文</p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-knock-text">
              {company.note}
            </p>
          </div>
        )}

        {/* 保険加入状況 */}
        {(company.fireInsurance || company.socialInsurance || company.otherInsurance) && (
          <div className={cardClass}>
            <p className={sectionTitleClass}>保険加入状況</p>
            <div className="flex flex-wrap gap-2">
              {company.fireInsurance && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-600">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7L6 10L11 4" stroke="#10B981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  火災保険
                </span>
              )}
              {company.socialInsurance && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-600">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7L6 10L11 4" stroke="#10B981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  社会保険
                </span>
              )}
              {company.otherInsurance && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-600">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7L6 10L11 4" stroke="#10B981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  その他保険
                </span>
              )}
            </div>
          </div>
        )}

        {/* 対応工種 */}
        {occupationGroups.size > 0 && (
          <div className={cardClass}>
            <p className={sectionTitleClass}>対応工種</p>
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
          </div>
        )}

        {/* 対応エリア */}
        {company.areas.length > 0 && (
          <div className={cardClass}>
            <p className={sectionTitleClass}>対応エリア</p>
            <div className="flex flex-wrap gap-1.5">
              {company.areas.map((a) => (
                <span
                  key={a.id}
                  className="rounded-full bg-amber-50 px-3 py-1 text-[12px] font-medium text-amber-600"
                >
                  {a.area?.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 固定ボタン */}
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

      {/* 承認ダイアログ */}
      <ConfirmDialog
        open={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={handleApprove}
        title="リクエストを承認"
        message={`${company.name} とのつながりを承認します。チャットルームが作成されます。`}
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
        message={`${company.name} からの連絡リクエストを拒否しますか？`}
        confirmLabel={processing ? "処理中..." : "拒否する"}
        cancelLabel="キャンセル"
        variant="danger"
      />
    </div>
  );
}
