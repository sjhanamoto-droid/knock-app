"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSite } from "@/lib/actions/sites";
import { searchContractors } from "@/lib/actions/contractors";
import { sendConnectionRequest } from "@/lib/actions/invitations";
import { ConfirmDialog, AlertDialog, useToast } from "@knock/ui";
import { useMode } from "@/lib/hooks/use-mode";

type SiteData = NonNullable<Awaited<ReturnType<typeof getSite>>>;
type Contractor = Awaited<ReturnType<typeof searchContractors>>[number];

const cardClass =
  "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "未設定";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export default function OrderSelectContractorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { accentColor } = useMode();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<SiteData | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [sendingRequestTo, setSendingRequestTo] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    Promise.all([getSite(siteId), searchContractors()])
      .then(([siteData, contractorData]) => {
        setSite(siteData);
        setContractors(contractorData);
      })
      .finally(() => setLoading(false));
  }, [siteId]);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    try {
      const results = await searchContractors({ keyword: keyword || undefined });
      setContractors(results);
    } finally {
      setSearching(false);
    }
  }, [keyword]);

  // Enter キーで検索
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  // つながり申請を送信
  async function handleSendRequest() {
    if (!confirmTarget) return;
    const companyId = confirmTarget.id;
    setSendingRequestTo(companyId);
    try {
      await sendConnectionRequest(companyId);
      setContractors((prev) =>
        prev.map((c) =>
          c.id === companyId
            ? { ...c, connectionStatus: "pending" as const }
            : c
        )
      );
      setSuccessMessage("つながり申請を送信しました");
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSendingRequestTo(null);
      setConfirmTarget(null);
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
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <span className="text-[14px] text-gray-400">現場が見つかりません</span>
        <button
          onClick={() => router.push("/sites")}
          className="text-[13px] font-semibold text-knock-blue"
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push(`/sites/${siteId}`)}
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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">受注者を選択</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-3 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {/* 現場サマリー */}
        <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-knock-text-secondary">
            発注する現場
          </p>
          <p className="mt-1 text-[15px] font-bold text-knock-text">
            {site.name}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-knock-text-secondary">
            {site.address && <span>{site.address}</span>}
            <span>
              {fmtDate(site.startDayRequest)} 〜 {fmtDate(site.endDayRequest)}
            </span>
          </div>
        </div>

        {/* 検索バー */}
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
          >
            <circle
              cx="8"
              cy="8"
              r="5.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M12.5 12.5L16 16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="会社名で検索"
            className="w-full rounded-xl bg-[#F0F0F0] border-none py-3 pl-10 pr-4 text-[14px] text-knock-text placeholder:text-knock-text-muted focus:outline-none"
          />
        </div>

        {/* 受注者一覧 */}
        {searching ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : contractors.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
            >
              <circle
                cx="18"
                cy="18"
                r="12"
                stroke="#D1D5DB"
                strokeWidth="2"
              />
              <path
                d="M27 27L35 35"
                stroke="#D1D5DB"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-[13px] text-knock-text-muted">
              該当する受注者が見つかりません
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-knock-text-secondary">
              {contractors.length}件の受注者
            </p>
            {contractors.map((c) => {
              const cardContent = (
                <div className="flex items-start gap-3">
                  {/* ロゴ */}
                  {c.logo ? (
                    <img
                      src={c.logo}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[12px] font-bold text-gray-400">
                      {c.name?.charAt(0) ?? "?"}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    {/* 会社名 + 接続ステータス */}
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold text-knock-text">
                        {c.name ?? "名称未設定"}
                      </p>
                      {c.connectionStatus === "connected" && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600">
                          メンバー
                        </span>
                      )}
                      {c.connectionStatus === "pending" && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                          承認待ち
                        </span>
                      )}
                    </div>

                    {/* 所在地 */}
                    {(c.prefecture || c.city) && (
                      <p className="mt-0.5 text-[12px] text-knock-text-secondary">
                        {c.prefecture}
                        {c.city}
                      </p>
                    )}

                    {/* 工種タグ */}
                    {c.occupations.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.occupations.slice(0, 3).map((occ) => (
                          <span
                            key={occ.id}
                            className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600"
                          >
                            {occ.occupationSubItem?.name}
                          </span>
                        ))}
                        {c.occupations.length > 3 && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                            +{c.occupations.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 右側: 接続済みは矢印、未接続はつながり申請ボタン */}
                  {c.connectionStatus === "connected" ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="mt-1 shrink-0"
                    >
                      <path
                        d="M6 4L10 8L6 12"
                        stroke="#9CA3AF"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : c.connectionStatus === "none" ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmTarget({ id: c.id, name: c.name ?? "この企業" });
                      }}
                      disabled={sendingRequestTo === c.id}
                      className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-[11px] font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                    >
                      {sendingRequestTo === c.id ? "送信中..." : "つながり申請"}
                    </button>
                  ) : null}
                </div>
              );

              if (c.connectionStatus === "connected") {
                return (
                  <Link
                    key={c.id}
                    href={`/sites/${siteId}/order/confirm?companyId=${c.id}`}
                    className={`${cardClass} block border-l-4 transition-colors active:bg-gray-50`}
                    style={{ borderLeftColor: accentColor }}
                  >
                    {cardContent}
                  </Link>
                );
              }

              return (
                <div
                  key={c.id}
                  className={`${cardClass} border-l-4 ${c.connectionStatus === "pending" ? "opacity-60" : ""}`}
                  style={{ borderLeftColor: accentColor }}
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* つながり申請 確認ダイアログ */}
      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleSendRequest}
        title="つながり申請"
        message={`${confirmTarget?.name ?? ""} に連絡リクエストを送信します。相手が承認するとチャットが開始されます。`}
        confirmLabel={sendingRequestTo ? "送信中..." : "送信する"}
        cancelLabel="キャンセル"
        variant="primary"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => setSuccessMessage("")}
        title="完了"
        message={successMessage}
      />
    </div>
  );
}
