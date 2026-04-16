"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getSite } from "@/lib/actions/sites";
import { createJobPosting } from "@/lib/actions/job-postings";

type SiteDetail = NonNullable<Awaited<ReturnType<typeof getSite>>>;

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "未設定";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function fmtAmount(n: number | bigint | null | undefined): string {
  if (n == null) return "-";
  return `¥${Number(n).toLocaleString("ja-JP")}`;
}

export default function SitePostJobPage() {
  const params = useParams();
  const router = useRouter();
  const { accentColor } = useMode();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 追加入力フィールド
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [requireInvoice, setRequireInvoice] = useState(false);
  const [requireExperienceYears, setRequireExperienceYears] = useState("");

  useEffect(() => {
    getSite(siteId)
      .then((data) => {
        setSite(data);
        if (data?.contentRequest) {
          setDescription(data.contentRequest);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  async function handleSubmit() {
    if (!site) return;

    setSubmitting(true);
    try {
      await createJobPosting({
        title: site.name ?? "現場案件",
        factoryFloorId: siteId,
        description: description || undefined,
        requirements: requirements || undefined,
        requireInvoice,
        requireExperienceYears: requireExperienceYears
          ? parseInt(requireExperienceYears)
          : undefined,
        compensationAmount: site.totalAmount
          ? Number(site.totalAmount)
          : undefined,
        startDate: site.startDayRequest
          ? new Date(site.startDayRequest).toISOString().split("T")[0]
          : undefined,
        endDate: site.endDayRequest
          ? new Date(site.endDayRequest).toISOString().split("T")[0]
          : undefined,
        address: site.address ?? undefined,
      });
      router.push(`/sites/${siteId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!site) {
    return <div className="p-4 text-center text-knock-text-muted">現場が見つかりません</div>;
  }

  const totalAmount = site.priceDetails?.reduce(
    (sum, d) => sum + Math.ceil((d.quantity ?? 0) * (Number(d.priceUnit) ?? 0)),
    0
  ) ?? 0;

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">案件を掲載</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none"><path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-3 pb-8 bg-[#F5F5F5]">
        {/* 現場情報サマリー（自動反映） */}
        <div className="rounded-2xl bg-gray-50 p-4">
          <h3 className="mb-2 text-[12px] font-bold text-knock-text-secondary">現場情報（自動反映）</h3>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <span className="text-[13px] text-knock-text-secondary">現場名</span>
              <span className="text-[13px] font-medium text-knock-text">{site.name}</span>
            </div>
            {site.address && (
              <div className="flex justify-between">
                <span className="text-[13px] text-knock-text-secondary">住所</span>
                <span className="text-right text-[13px] text-knock-text">{site.address}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[13px] text-knock-text-secondary">工期</span>
              <span className="text-[13px] text-knock-text">
                {fmtDate(site.startDayRequest)} 〜 {fmtDate(site.endDayRequest)}
              </span>
            </div>
            {totalAmount > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-[13px] text-knock-text-secondary">小計</span>
                  <span className="text-[13px] text-knock-text">{fmtAmount(totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[13px] text-knock-text-secondary">消費税（10%）</span>
                  <span className="text-[13px] text-knock-text">{fmtAmount(Math.floor(totalAmount * 0.1))}</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-1">
                  <span className="text-[13px] font-bold text-knock-text">合計金額（税込）</span>
                  <span className="text-[13px] font-bold text-knock-text">{fmtAmount(totalAmount + Math.floor(totalAmount * 0.1))}</span>
                </div>
              </>
            )}
            {site.occupations && site.occupations.length > 0 && (
              <div className="flex justify-between">
                <span className="text-[13px] text-knock-text-secondary">工種</span>
                <span className="text-right text-[13px] text-knock-text">
                  {site.occupations.map((o) => o.occupationSubItem?.name).filter(Boolean).join("、")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 詳細説明 */}
        <div>
          <label className="mb-1 block text-[13px] font-bold text-knock-text">詳細説明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="工事の詳細をお書きください"
            className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px]"
          />
        </div>

        {/* 求める条件 */}
        <div>
          <label className="mb-1 block text-[13px] font-bold text-knock-text">求める条件</label>
          <label className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={requireInvoice}
              onChange={(e) => setRequireInvoice(e.target.checked)}
            />
            <span className="text-[14px]">インボイス登録済み</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[14px]">現場経験</span>
            <input
              type="number"
              value={requireExperienceYears}
              onChange={(e) => setRequireExperienceYears(e.target.value)}
              placeholder="0"
              className="w-16 rounded-lg bg-[#F0F0F0] border-none px-2 py-1 text-center text-[14px]"
            />
            <span className="text-[14px]">年以上</span>
          </div>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={2}
            placeholder="その他の条件（任意）"
            className="mt-2 w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px]"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          {submitting ? "掲載中..." : "案件を掲載する"}
        </button>
      </div>
    </div>
  );
}
