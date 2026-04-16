"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSites } from "@/lib/actions/sites";

type SiteList = Awaited<ReturnType<typeof getSites>>;

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "未設定";
  const date = typeof d === "string" ? new Date(d) : d;
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}(${dayNames[date.getDay()]})`;
}

export default function SelectSitePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId");
  const roomId = params.roomId as string;

  const [sites, setSites] = useState<SiteList>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      getSites("NOT_ORDERED", search || undefined)
        .then(setSites)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="flex h-[100dvh] flex-col bg-[#F5F5F5]">
      {/* Header — V1: ← centered title */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="relative flex items-center justify-center px-4 py-3">
          <button
            onClick={() => router.back()}
            className="absolute left-4 flex h-10 w-10 items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 5L8 12L15 19" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[17px] font-bold text-knock-text">現場選択</h1>
        </div>
      </header>

      {/* Search — V1: gray pill, no border */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 text-gray-400">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="現場名検索"
            className="flex-1 bg-transparent text-[14px] text-knock-text placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Site list */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : sites.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-gray-400">
            {search ? "該当する現場がありません" : "未発注の現場がありません"}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() =>
                  router.push(
                    `/chat/${roomId}/order?siteId=${site.id}&companyId=${companyId}`
                  )
                }
                className="overflow-hidden rounded-2xl bg-white text-left shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98]"
              >
                {/* Blue top accent line — V1 style */}
                <div className="h-[3px] bg-blue-400" />

                <div className="p-4">
                  <div className="flex items-start justify-between">
                    {/* Status badge — V1: red/orange 未発注 */}
                    <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-500">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
                        <path d="M7 4V7.5M7 9.5V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      未発注
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      {/* Site name — V1: bold, larger */}
                      <p className="text-[16px] font-bold text-knock-text">
                        {site.name}
                      </p>

                      {/* Address — V1: pin icon + address */}
                      {site.address && (
                        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-knock-text-secondary">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-gray-400">
                            <path d="M7 1.5C5.067 1.5 3.5 3.067 3.5 5C3.5 7.75 7 12.5 7 12.5C7 12.5 10.5 7.75 10.5 5C10.5 3.067 8.933 1.5 7 1.5Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
                            <circle cx="7" cy="5" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
                          </svg>
                          {site.address}
                        </p>
                      )}

                      {/* Date range — V1: calendar icon + dates */}
                      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-knock-text-secondary">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-gray-400">
                          <rect x="1.5" y="2.5" width="11" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                          <path d="M1.5 5.5H12.5M4.5 1V3.5M9.5 1V3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                        </svg>
                        {fmtDate(site.startDayRequest)} ~ {fmtDate(site.endDayRequest)}
                      </p>

                      {/* Company — V1: small logo + name */}
                      {site.workCompany?.name && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-100">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-400">
                              <path d="M2 12V4L7 1L12 4V12H2Z" stroke="currentColor" strokeWidth="1" fill="none" />
                              <rect x="5" y="6" width="4" height="6" stroke="currentColor" strokeWidth="0.8" fill="none" />
                              <path d="M4 5H5M9 5H10M4 8H5M9 8H10" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
                            </svg>
                          </div>
                          <span className="text-[12px] text-knock-text-secondary">
                            {site.workCompany.name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Arrow — V1: blue filled circle with > */}
                    <div className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 4L10 8L6 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
