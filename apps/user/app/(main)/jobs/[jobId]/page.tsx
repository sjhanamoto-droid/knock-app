"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getJobDetail, applyToJob } from "@/lib/actions/job-search";
import { checkContractorRequirements } from "@/lib/actions/contractor-requirements";
import { formatCurrency } from "@knock/utils";

type JobDetail = Awaited<ReturnType<typeof getJobDetail>>;

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const { accentColor } = useMode();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [checkingReqs, setCheckingReqs] = useState(false);

  useEffect(() => {
    getJobDetail(jobId)
      .then(setJob)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  async function handleApply() {
    setApplying(true);
    try {
      await applyToJob({ jobPostingId: jobId, message: message || undefined });
      alert("応募しました");
      router.replace("/jobs");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!job) {
    return <div className="p-4 text-center text-knock-text-muted">案件が見つかりません</div>;
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">案件詳細</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none"><path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        <h2 className="text-[18px] font-bold text-knock-text">{job.title}</h2>

        {/* 発注者情報 */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]" style={{ borderLeft: `4px solid ${accentColor}` }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="4" width="10" height="8" rx="1" stroke="#9CA3AF" strokeWidth="1" /><path d="M5 4V2.5H9V4" stroke="#9CA3AF" strokeWidth="1" strokeLinecap="round" /></svg>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-knock-text">{job.company.name}</p>
              <p className="text-[12px] text-knock-text-secondary">
                {job.company.prefecture}{job.company.city}
              </p>
            </div>
            {job.company.trustScore && (
              <span className="flex items-center gap-1 text-[12px] text-amber-600">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.545 4.13L11 4.635L8.5 7.07L9.09 10.51L6 8.885L2.91 10.51L3.5 7.07L1 4.635L4.455 4.13L6 1Z" fill="#F59E0B" /></svg>
                {Number(job.company.trustScore.overallScore).toFixed(1)}
                ({job.company.trustScore.totalTransactions}件)
              </span>
            )}
          </div>
        </div>

        {/* 工事概要 */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]" style={{ borderLeft: `4px solid ${accentColor}` }}>
          <h3 className="mb-3 text-[13px] font-bold text-knock-text">工事概要</h3>
          <div className="flex flex-col gap-2 text-[13px]">
            {job.occupationSubItem && (
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">種別</span>
                <span className="text-knock-text">{job.occupationSubItem.name}</span>
              </div>
            )}
            {job.factoryFloor?.address && (
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">場所</span>
                <span className="text-knock-text">{job.factoryFloor.address}</span>
              </div>
            )}
            {job.address && !job.factoryFloor?.address && (
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">場所</span>
                <span className="text-knock-text">{job.address}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-knock-text-secondary">工期</span>
              <span className="text-knock-text">
                {job.startDate
                  ? new Date(job.startDate).toLocaleDateString("ja-JP")
                  : "未定"}
                〜
                {job.endDate
                  ? new Date(job.endDate).toLocaleDateString("ja-JP")
                  : "未定"}
              </span>
            </div>
            {job.compensationAmount && (
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">報酬</span>
                <span className="font-bold" style={{ color: accentColor }}>
                  {formatCurrency(job.compensationAmount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 詳細説明 */}
        {job.description && (
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]" style={{ borderLeft: `4px solid ${accentColor}` }}>
            <h3 className="mb-2 text-[13px] font-bold text-knock-text">詳細説明</h3>
            <p className="whitespace-pre-wrap text-[13px] text-knock-text">{job.description}</p>
          </div>
        )}

        {/* 求める条件 */}
        {(job.requirements || job.requireInvoice || job.requireExperienceYears) && (
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]" style={{ borderLeft: `4px solid ${accentColor}` }}>
            <h3 className="mb-2 text-[13px] font-bold text-knock-text">求める条件</h3>
            <ul className="flex flex-col gap-1 text-[13px] text-knock-text">
              {job.requireInvoice && <li>・インボイス登録済み</li>}
              {job.requireExperienceYears && (
                <li>・現場経験{job.requireExperienceYears}年以上</li>
              )}
              {job.requirements && <li>・{job.requirements}</li>}
            </ul>
          </div>
        )}

        {/* 現場情報（FactoryFloorリンクがある場合） */}
        {job.factoryFloor && (
          <>
            {/* 工種 */}
            {job.factoryFloor.occupations && job.factoryFloor.occupations.length > 0 && (
              <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]" style={{ borderLeft: `4px solid ${accentColor}` }}>
                <h3 className="mb-2 text-[13px] font-bold text-knock-text">工種</h3>
                <div className="flex flex-wrap gap-1.5">
                  {job.factoryFloor.occupations.map((occ, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-gray-100 px-3 py-1 text-[12px] text-knock-text"
                    >
                      {occ.occupationSubItem?.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 明細 */}
            {job.factoryFloor.priceDetails && job.factoryFloor.priceDetails.length > 0 && (
              <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]" style={{ borderLeft: `4px solid ${accentColor}` }}>
                <h3 className="mb-2 text-[13px] font-bold text-knock-text">
                  明細 ({job.factoryFloor.priceDetails.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {job.factoryFloor.priceDetails.map((detail) => {
                    const subtotal = Math.ceil((detail.quantity ?? 0) * (Number(detail.priceUnit) || 0));
                    return (
                      <div key={detail.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                        <div className="flex items-start justify-between">
                          <span className="text-[13px] font-medium text-knock-text">{detail.name}</span>
                          <span className="text-[13px] font-bold text-knock-text">
                            ¥{subtotal.toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-knock-text-secondary">
                          <span>{detail.quantity} × ¥{Number(detail.priceUnit).toLocaleString()}</span>
                          {detail.unit && <span>{detail.unit.name}</span>}
                          {detail.specifications && <span className="truncate">{detail.specifications}</span>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-1 rounded-xl bg-gray-50 px-4 py-3 text-right">
                    <span className="text-[13px] text-gray-600">合計: </span>
                    <span className="text-[16px] font-bold" style={{ color: accentColor }}>
                      ¥{job.factoryFloor.priceDetails
                        .reduce((sum, d) => sum + Math.ceil((d.quantity ?? 0) * (Number(d.priceUnit) || 0)), 0)
                        .toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 図面・写真 */}
            {job.factoryFloor.images && job.factoryFloor.images.length > 0 && (
              <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]" style={{ borderLeft: `4px solid ${accentColor}` }}>
                {(() => {
                  const drawings = job.factoryFloor!.images.filter((img) => img.type === 1);
                  const photos = job.factoryFloor!.images.filter((img) => img.type === 2);
                  return (
                    <>
                      {drawings.length > 0 && (
                        <>
                          <h3 className="mb-2 text-[13px] font-bold text-knock-text">図面 ({drawings.length})</h3>
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {drawings.map((img) => (
                              <div key={img.id} className="aspect-square overflow-hidden rounded-lg border border-gray-200">
                                <img src={img.url} alt="図面" className="h-full w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {photos.length > 0 && (
                        <>
                          <h3 className="mb-2 text-[13px] font-bold text-knock-text">現場写真 ({photos.length})</h3>
                          <div className="grid grid-cols-3 gap-2">
                            {photos.map((img) => (
                              <div key={img.id} className="aspect-square overflow-hidden rounded-lg border border-gray-200">
                                <img src={img.url} alt="写真" className="h-full w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}

        {/* 現場写真（JobPosting直接添付の場合） */}
        {!job.factoryFloor && job.images && (job.images as string[]).length > 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]" style={{ borderLeft: `4px solid ${accentColor}` }}>
            <h3 className="mb-2 text-[13px] font-bold text-knock-text">現場写真</h3>
            <div className="flex flex-wrap gap-2">
              {(job.images as string[]).map((url, i) => (
                <div key={i} className="aspect-square w-20 overflow-hidden rounded-xl border border-gray-200">
                  <img src={url} alt={`写真${i + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 応募ボタン */}
        {showApplyForm ? (
          <div className="flex flex-col gap-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="応募メッセージ（任意）"
              className="w-full rounded-xl border-none bg-[#F0F0F0] px-4 py-3 text-[14px]"
            />
            <button
              onClick={handleApply}
              disabled={applying}
              className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {applying ? "送信中..." : "応募する"}
            </button>
            <button
              onClick={() => setShowApplyForm(false)}
              className="text-[13px] text-knock-text-secondary"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={async () => {
                setCheckingReqs(true);
                try {
                  const reqs = await checkContractorRequirements();
                  if (!reqs.complete) {
                    alert("案件を受けるには必要情報が足りません。追加してください。\n\n不足: " + reqs.missing.join("、"));
                    router.push(`/mypage/requirements?returnTo=/jobs/${jobId}`);
                    return;
                  }
                  setShowApplyForm(true);
                } catch {
                  setShowApplyForm(true);
                } finally {
                  setCheckingReqs(false);
                }
              }}
              disabled={checkingReqs}
              className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {checkingReqs ? "確認中..." : "この案件に応募する"}
            </button>
            <button
              onClick={() => {
                // TODO: メッセージ送信機能
                alert("チャット機能に遷移します");
              }}
              className="w-full rounded-xl border-2 py-3.5 text-[15px] font-bold transition-all active:scale-[0.97]"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              メッセージを送る
            </button>
          </>
        )}
      </div>
    </div>
  );
}
