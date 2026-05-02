"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getApplicationDetail,
  acceptApplication,
  rejectApplication,
} from "@/lib/actions/job-postings";
import { ConfirmDialog, useToast } from "@knock/ui";

import { useMode } from "@/lib/hooks/use-mode";

type AppDetail = NonNullable<Awaited<ReturnType<typeof getApplicationDetail>>>;

const cardClass = "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";
const labelClass = "text-[12px] text-knock-text-secondary";

const permitLabels: Record<string, string> = {
  NONE: "取得していない",
  MLIT_GENERAL: "国土交通大臣許可（一般）",
  MLIT_SPECIAL: "国土交通大臣許可（特定）",
  GOVERNOR_GENERAL: "都道府県知事許可（一般）",
  GOVERNOR_SPECIAL: "都道府県知事許可（特定）",
};

const insuranceTypeLabels: Record<string, string> = {
  FIRE: "火災保険",
  LIABILITY: "賠償責任保険",
  WORKERS_ACCIDENT: "労働災害補償保険",
  VEHICLE: "自動車保険",
  OTHER: "その他",
};

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
      <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function ApplicationDetailPage() {
  const { jobId, applicationId } = useParams<{ jobId: string; applicationId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { accentColor } = useMode();
  const [app, setApp] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"accept" | "reject" | null>(null);

  useEffect(() => {
    getApplicationDetail(applicationId)
      .then(setApp)
      .finally(() => setLoading(false));
  }, [applicationId]);

  async function handleAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction === "accept") {
        await acceptApplication(applicationId);
        toast("採用しました");
      } else {
        await rejectApplication(applicationId);
        toast("見送りしました");
      }
      // Reload data
      const updated = await getApplicationDetail(applicationId);
      setApp(updated);
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!app) {
    return <div className="p-4 text-center text-knock-text-muted">応募が見つかりません</div>;
  }

  const isPending = app.status === "PENDING";
  const statusLabel = app.status === "ACCEPTED" ? "採用済み" : app.status === "REJECTED" ? "見送り" : "審査中";
  const statusColor =
    app.status === "ACCEPTED"
      ? { bg: "#D1FAE5", text: "#065F46" }
      : app.status === "REJECTED"
        ? { bg: "#FEE2E2", text: "#991B1B" }
        : { bg: "#FEF3C7", text: "#92400E" };

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
        <h1 className="text-[16px] font-bold text-[#1A2340]">応募詳細</h1>
        <div className="flex justify-center mt-1">
          <WavyUnderline color={accentColor} />
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* ステータスバナー */}
        <div
          className="rounded-xl px-4 py-3 text-center text-[14px] font-bold"
          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
        >
          {statusLabel}
        </div>

        {/* 会社情報 */}
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 overflow-hidden">
              {app.company.logo ? (
                <img src={app.company.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9L12 2L21 9V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V9Z" stroke="#9CA3AF" strokeWidth="1.5" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-[16px] font-bold text-[#1A2340]">{app.company.name}</p>
              {app.company.prefecture && (
                <p className="text-[12px] text-knock-text-secondary">
                  {app.company.prefecture}{app.company.city}
                </p>
              )}
            </div>
          </div>

          {/* 職種 */}
          {app.company.occupations.length > 0 && (
            <div className="mb-3">
              <p className={labelClass}>職種</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {app.company.occupations.map((o, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-gray-100 px-2.5 py-1 text-[12px] text-knock-text"
                  >
                    {o.occupationSubItem.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 対応エリア */}
          {app.company.areas.length > 0 && (
            <div className="mb-3">
              <p className={labelClass}>対応エリア</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {app.company.areas.map((a, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-blue-50 px-2.5 py-1 text-[12px] text-blue-700"
                  >
                    {a.area.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 詳細情報 */}
          <div className="space-y-2 border-t border-gray-100 pt-3">
            {app.company.constructionPermit && (
              <div className="flex justify-between">
                <span className={labelClass}>建設業許可</span>
                <span className="text-[13px] text-[#1A2340]">
                  {permitLabels[app.company.constructionPermit] ?? app.company.constructionPermit}
                </span>
              </div>
            )}
            {app.company.socialInsurance != null && (
              <div className="flex justify-between">
                <span className={labelClass}>社会保険</span>
                <span className="text-[13px] text-[#1A2340]">
                  {app.company.socialInsurance ? "加入" : "未加入"}
                </span>
              </div>
            )}
            {app.company.invoiceNumber && (
              <div className="flex justify-between">
                <span className={labelClass}>インボイス番号</span>
                <span className="text-[13px] text-[#1A2340]">{app.company.invoiceNumber}</span>
              </div>
            )}
            {app.company.insurances.length > 0 && (
              <div className="flex justify-between">
                <span className={labelClass}>その他保険</span>
                <span className="text-[13px] text-[#1A2340]">
                  {app.company.insurances.map((i) => insuranceTypeLabels[i.type] ?? i.type).join("、")}
                </span>
              </div>
            )}
          </div>

          {/* 詳細を見るボタン */}
          <Link
            href={`/search/${app.company.id}`}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-[13px] font-bold text-gray-600 transition-all active:scale-[0.98] active:bg-gray-50"
          >
            詳細を見る
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M8 4L14 10L8 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* 応募メッセージ */}
        {app.message && (
          <div className={cardClass}>
            <p className="text-[13px] font-bold text-[#1A2340] mb-2">応募メッセージ</p>
            <p className="text-[14px] text-knock-text whitespace-pre-wrap">{app.message}</p>
          </div>
        )}

        {/* 応募情報 */}
        <div className={cardClass}>
          <p className="text-[13px] font-bold text-[#1A2340] mb-2">応募情報</p>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className={labelClass}>案件名</span>
              <span className="text-[13px] text-[#1A2340]">{app.jobPosting.title}</span>
            </div>
            <div className="flex justify-between">
              <span className={labelClass}>応募日時</span>
              <span className="text-[13px] text-[#1A2340]">
                {new Date(app.createdAt).toLocaleString("ja-JP")}
              </span>
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        {isPending && (
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmAction("reject")}
              disabled={actionLoading}
              className="flex-1 rounded-xl border border-gray-300 py-3.5 text-[14px] font-bold text-gray-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              見送る
            </button>
            <button
              onClick={() => setConfirmAction("accept")}
              disabled={actionLoading}
              className="flex-1 rounded-xl py-3.5 text-[14px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              採用する
            </button>
          </div>
        )}
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAction}
        title={confirmAction === "accept" ? "採用の確認" : "見送りの確認"}
        message={
          confirmAction === "accept"
            ? `${app.company.name} を採用します。よろしいですか？`
            : `${app.company.name} の応募を見送ります。よろしいですか？`
        }
        confirmLabel={confirmAction === "accept" ? "採用する" : "見送る"}
        variant={confirmAction === "reject" ? "danger" : "primary"}
      />
    </div>
  );
}
