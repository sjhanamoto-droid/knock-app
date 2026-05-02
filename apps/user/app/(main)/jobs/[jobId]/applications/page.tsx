"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getApplicationsForJob } from "@/lib/actions/job-postings";
import { useMode } from "@/lib/hooks/use-mode";

type ApplicationList = Awaited<ReturnType<typeof getApplicationsForJob>>;

const statusLabels: Record<string, string> = {
  PENDING: "審査中",
  ACCEPTED: "採用",
  REJECTED: "見送り",
};

const statusColors: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "#FEF3C7", text: "#92400E" },
  ACCEPTED: { bg: "#D1FAE5", text: "#065F46" },
  REJECTED: { bg: "#FEE2E2", text: "#991B1B" },
};

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
      <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function ApplicationsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const { accentColor } = useMode();
  const [applications, setApplications] = useState<ApplicationList>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApplicationsForJob(jobId)
      .then(setApplications)
      .catch((e) => setError(e instanceof Error ? e.message : "エラーが発生しました"))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-knock-text-muted">{error}</div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-24">
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
        <h1 className="text-[16px] font-bold text-[#1A2340]">応募一覧</h1>
        <div className="flex justify-center mt-1">
          <WavyUnderline color={accentColor} />
        </div>
      </div>

      {/* 応募一覧 */}
      <div className="p-4 space-y-3">
        {applications.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <p className="text-[14px] text-knock-text-secondary">まだ応募はありません</p>
          </div>
        ) : (
          applications.map((app) => {
            const sc = statusColors[app.status] ?? statusColors.PENDING;
            return (
              <Link
                key={app.id}
                href={`/jobs/${jobId}/applications/${app.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98]"
              >
                {/* ロゴ */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 overflow-hidden">
                  {app.company.logo ? (
                    <img src={app.company.logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M3 9L12 2L21 9V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V9Z" stroke="#9CA3AF" strokeWidth="1.5" />
                    </svg>
                  )}
                </div>

                {/* 情報 */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#1A2340] truncate">
                    {app.company.name}
                  </p>
                  <p className="text-[12px] text-knock-text-secondary mt-0.5">
                    {app.company.occupations
                      .map((o) => o.occupationSubItem.name)
                      .slice(0, 3)
                      .join("、") || "職種未設定"}
                  </p>
                  <p className="text-[11px] text-knock-text-secondary mt-0.5">
                    {new Date(app.createdAt).toLocaleDateString("ja-JP")} 応募
                  </p>
                </div>

                {/* ステータス */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ backgroundColor: sc.bg, color: sc.text }}
                  >
                    {statusLabels[app.status] ?? app.status}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
