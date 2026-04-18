"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSite, deleteSite, duplicateSite, getProjectSummary } from "@/lib/actions/sites";
import {
  factoryFloorStatusLabels,
  factoryFloorStatusColors,
} from "@knock/utils";
import { ConfirmDialog, useToast } from "@knock/ui";
import { useMode } from "@/lib/hooks/use-mode";

type SiteDetail = NonNullable<Awaited<ReturnType<typeof getSite>>>;
type ActiveTab = "detail" | "images" | "children";
type ProjectSummary = Awaited<ReturnType<typeof getProjectSummary>>;

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "未設定";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function fmtAmount(n: number | bigint | null | undefined): string {
  if (n == null) return "-";
  return `${Number(n).toLocaleString("ja-JP")}円`;
}

/* ──────────── Wavy Underline SVG ──────────── */

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

const cardClass =
  "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";
const labelClass = "text-[12px] font-bold text-knock-text";
const valueClass = "text-[14px] text-knock-text";
const dividerClass = "border-t border-gray-100 my-3";

const PAYMENT_TYPE_LABELS: Record<number, string> = {
  1: "現金",
  2: "振込",
  3: "手形",
};

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isOrderer, accentColor } = useMode();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("detail");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    getSite(params.siteId as string)
      .then((s) => {
        setSite(s);
        // 親現場の場合、予算管理データを取得
        if (s && !s.parentId) {
          getProjectSummary(s.id).then(setProjectSummary).catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, [params.siteId]);

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const newSite = await duplicateSite(params.siteId as string);
      toast("現場を複製しました");
      router.push(`/sites/${newSite.id}/edit`);
    } catch {
      toast("複製に失敗しました");
      setDuplicating(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteSite(params.siteId as string);
      toast("現場を削除しました");
      router.push("/sites");
      router.refresh();
    } catch {
      setDeleting(false);
      setShowDeleteDialog(false);
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
        <span className="text-[14px] text-gray-400">
          現場が見つかりません
        </span>
        <Link
          href="/sites"
          className="text-[13px] font-semibold text-knock-blue"
        >
          一覧に戻る
        </Link>
      </div>
    );
  }

  const drawings = site.images?.filter((img) => img.type === 1) ?? [];
  const photos = site.images?.filter((img) => img.type === 2) ?? [];
  const invoicePdfs = site.pdfs?.filter((pdf) => pdf.type === 1) ?? [];
  const hasFinancial =
    site.totalAmount != null ||
    site.totalAdvancePayment != null ||
    site.expenses != null;
  const hasPaymentTerms =
    site.paymentType != null ||
    site.paymentLatterMonth != null ||
    site.paymentLatterDay != null;

  const priceDetailsSubtotal = site.priceDetails?.reduce(
    (sum, d) => sum + Math.ceil((d.quantity ?? 0) * (Number(d.priceUnit) ?? 0)),
    0
  ) ?? 0;

  // Site info chat room (現場情報ルーム)
  const siteInfoRoom = site.chatRooms?.[0] ?? null;
  const siteInfoRoomId = siteInfoRoom?.id ?? null;

  // 親現場かどうか（parentId がなく発注者の場合）
  const isParentSite = !site.parentId && isOrderer;

  // Site type label: orderer sees 発注現場, contractor sees 受注現場
  const siteTypeLabel = isParentSite ? "プロジェクト" : isOrderer ? "発注現場" : "受注現場";

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="relative flex items-center justify-between px-4 py-3">
          {/* Back button */}
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

          {/* Centered title */}
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
              {isParentSite ? "プロジェクト詳細" : "現場詳細情報"}
            </h1>
            <WavyUnderline color={accentColor} />
          </div>

          {/* Action menu button */}
          {(isOrderer || siteInfoRoomId) ? (
            <div className="relative">
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="4" r="1.5" fill="#1A1A1A" />
                  <circle cx="10" cy="10" r="1.5" fill="#1A1A1A" />
                  <circle cx="10" cy="16" r="1.5" fill="#1A1A1A" />
                </svg>
              </button>
              {showActionMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowActionMenu(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
                    {/* 現場情報ルームへ移動 */}
                    {siteInfoRoomId && (
                      <Link
                        href={`/chat/${siteInfoRoomId}`}
                        onClick={() => setShowActionMenu(false)}
                        className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path
                            d="M14 8C14 10.761 11.538 13 8.5 13C7.55 13 6.652 12.808 5.852 12.462L3 13L3.876 10.904C3.32 10.139 3 9.236 3 8.269C3 5.508 5.462 3.269 8.5 3.269"
                            stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
                          />
                          <circle cx="6.5" cy="8" r="0.7" fill="#3B82F6" />
                          <circle cx="8.5" cy="8" r="0.7" fill="#3B82F6" />
                          <circle cx="10.5" cy="8" r="0.7" fill="#3B82F6" />
                        </svg>
                        現場情報ルーム
                      </Link>
                    )}
                    {isOrderer && (
                      <>
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            handleDuplicate();
                          }}
                          disabled={duplicating}
                          className={`flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 ${siteInfoRoomId ? "border-t border-gray-100" : ""}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="#6B6B6B" strokeWidth="1.3" />
                            <path d="M11 5V3.5C11 2.67 10.33 2 9.5 2H3.5C2.67 2 2 2.67 2 3.5V9.5C2 10.33 2.67 11 3.5 11H5" stroke="#6B6B6B" strokeWidth="1.3" />
                          </svg>
                          {duplicating ? "複製中..." : "複製"}
                        </button>
                        {["DRAFT", "NOT_ORDERED", "ORDERED", "ORDER_REQUESTED"].includes(site.status) && (
                          <Link
                            href={`/sites/${site.id}/edit`}
                            onClick={() => setShowActionMenu(false)}
                            className="flex w-full items-center gap-2.5 border-t border-gray-100 px-4 py-3 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M11.5 2.5L13.5 4.5L5.5 12.5H3.5V10.5L11.5 2.5Z" stroke="#6B6B6B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            編集
                          </Link>
                        )}
                        {["DRAFT", "NOT_ORDERED"].includes(site.status) && (
                          <button
                            onClick={() => {
                              setShowActionMenu(false);
                              setShowDeleteDialog(true);
                            }}
                            disabled={deleting}
                            className="flex w-full items-center gap-2.5 border-t border-gray-100 px-4 py-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M3 4H13M6 4V3C6 2.45 6.45 2 7 2H9C9.55 2 10 2.45 10 3V4M12 4V13C12 13.55 11.55 14 11 14H5C4.45 14 4 13.55 4 13V4" stroke="#EF4444" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            削除
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        {/* Site type pill + status badge row */}
        <div className="relative flex items-center justify-center px-4 pb-3">
          <span className="rounded-full bg-knock-text px-5 py-1.5 text-[13px] font-bold text-white">
            {siteTypeLabel}
          </span>
          <span
            className={`absolute right-4 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              factoryFloorStatusColors[site.status] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {factoryFloorStatusLabels[site.status] ?? site.status}
          </span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-full bg-gray-100 mx-4 mb-3 p-1">
          <button
            onClick={() => setActiveTab("detail")}
            className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
              activeTab === "detail"
                ? "bg-knock-text text-white shadow-sm"
                : "text-gray-500"
            }`}
          >
            {isParentSite ? "概要" : "現場詳細"}
          </button>
          {isParentSite && (
            <button
              onClick={() => setActiveTab("children")}
              className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
                activeTab === "children"
                  ? "bg-knock-text text-white shadow-sm"
                  : "text-gray-500"
              }`}
            >
              工事一覧
            </button>
          )}
          <button
            onClick={() => setActiveTab("images")}
            className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
              activeTab === "images"
                ? "bg-knock-text text-white shadow-sm"
                : "text-gray-500"
            }`}
          >
            画像
          </button>
        </div>
      </header>

      {/* ─── "画像" tab content ─── */}
      {activeTab === "images" && (
        <div className={`flex flex-col gap-3 px-4 pt-3 ${site.status === "NOT_ORDERED" && isOrderer && !isParentSite ? "pb-40" : "pb-8"}`}>
          {drawings.length === 0 && photos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white py-12 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="5" y="8" width="30" height="24" rx="3" stroke="#D1D5DB" strokeWidth="1.8" />
                <circle cx="14" cy="18" r="3" stroke="#D1D5DB" strokeWidth="1.6" />
                <path d="M5 28L13 20L19 26L25 20L35 30" stroke="#D1D5DB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[13px] text-knock-text-muted">画像がありません</span>
            </div>
          ) : (
            <>
              {/* 図面 */}
              {drawings.length > 0 && (
                <div className={cardClass}>
                  <h3 className="mb-3 text-[14px] font-bold text-knock-text">図面 ({drawings.length})</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {drawings.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setPreviewImage(img.url)}
                        className="aspect-square overflow-hidden rounded-lg border border-gray-200 active:scale-[0.98]"
                      >
                        <img
                          src={img.url}
                          alt="図面"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 写真 */}
              {photos.length > 0 && (
                <div className={cardClass}>
                  <h3 className="mb-3 text-[14px] font-bold text-knock-text">写真 ({photos.length})</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setPreviewImage(img.url)}
                        className="aspect-square overflow-hidden rounded-lg border border-gray-200 active:scale-[0.98]"
                      >
                        <img
                          src={img.url}
                          alt="写真"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── "工事一覧" tab content (parent sites only) ─── */}
      {activeTab === "children" && isParentSite && (
        <div className="flex flex-col gap-3 px-4 pt-3 pb-8">
          {/* 工事を追加ボタン */}
          <Link
            href={`/sites/new?parentId=${site.id}`}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 py-4 text-[14px] font-bold text-gray-500 transition-all active:scale-[0.98] active:border-gray-400"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 3V15M3 9H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            工事を追加
          </Link>

          {/* 子現場一覧 */}
          {site.children && site.children.length > 0 ? (
            site.children.map((child: {
              id: string;
              name: string | null;
              status: string;
              totalAmount: number | bigint | null;
              workCompany?: { id: string; name: string | null } | null;
              orders?: { id: string; status: string | null; actualAmount: number | bigint | null }[];
            }) => (
              <Link
                key={child.id}
                href={`/sites/${child.id}`}
                className="overflow-hidden rounded-xl bg-white shadow-[0_1px_6px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98]"
                style={{ borderLeft: `4px solid ${accentColor}` }}
              >
                <div className="px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        factoryFloorStatusColors[child.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {factoryFloorStatusLabels[child.status] ?? child.status}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 3L9 7L5 11" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-[14px] font-bold text-knock-text">
                    {child.name ?? "名称未設定"}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    {child.workCompany ? (
                      <span className="text-[12px] text-gray-500">{child.workCompany.name}</span>
                    ) : (
                      <span className="text-[12px] text-gray-400">業者未選択</span>
                    )}
                    {child.totalAmount != null && Number(child.totalAmount) > 0 && (
                      <span className="text-[12px] font-semibold text-knock-text">
                        {fmtAmount(child.totalAmount)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white py-12 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <span className="text-[13px] text-knock-text-muted">
                工事がありません
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── "現場詳細" tab content ─── */}
      {activeTab === "detail" && (
        <div className={`flex flex-col gap-3 px-4 pt-3 ${site.status === "NOT_ORDERED" && isOrderer && !isParentSite ? "pb-40" : "pb-8"}`}>

          {/* 予算管理カード（親現場のみ） */}
          {isParentSite && projectSummary && (
            <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-[14px] font-bold text-knock-text">予算管理</h3>
              </div>
              <div className="px-4 pb-4">
                <div className={dividerClass} />
                <div className="flex items-center justify-between">
                  <p className={labelClass}>全体予算</p>
                  <p className="text-[15px] font-bold text-knock-text">{fmtAmount(projectSummary.budget)}</p>
                </div>
                <div className={dividerClass} />
                <div className="flex items-center justify-between">
                  <p className={labelClass}>発注合計</p>
                  <p className={valueClass}>{fmtAmount(projectSummary.orderedTotal)}</p>
                </div>
                <div className={dividerClass} />
                <div className="flex items-center justify-between">
                  <p className={labelClass}>実績合計</p>
                  <p className={valueClass}>{fmtAmount(projectSummary.actualTotal)}</p>
                </div>
                <div className={dividerClass} />
                <div className="flex items-center justify-between">
                  <p className={labelClass}>差額（予算 − 発注）</p>
                  <p className={`text-[15px] font-bold ${projectSummary.diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {projectSummary.diff >= 0 ? "+" : ""}{fmtAmount(projectSummary.diff)}
                  </p>
                </div>
                {/* 消化率プログレスバー */}
                {projectSummary.budget > 0 && (
                  <>
                    <div className={dividerClass} />
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[11px] text-gray-500">予算消化率</p>
                        <p className="text-[11px] font-bold text-knock-text">
                          {Math.min(100, Math.round((projectSummary.orderedTotal / projectSummary.budget) * 100))}%
                        </p>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            projectSummary.orderedTotal / projectSummary.budget > 1
                              ? "bg-red-500"
                              : "bg-green-500"
                          }`}
                          style={{
                            width: `${Math.min(100, Math.round((projectSummary.orderedTotal / projectSummary.budget) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 1. 基本情報 */}
          <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            {/* Site name header */}
            <div className="px-4 pt-4 pb-3">
              <h2 className="text-[16px] font-bold text-knock-text">
                {site.name ?? "名称未設定"}
              </h2>
              {site.code && (
                <p className="mt-0.5 text-[12px] text-knock-text-secondary">
                  コード: {site.code}
                </p>
              )}
            </div>

            {/* Field list with dividers */}
            <div className="px-4 pb-4">
              {site.address && (
                <>
                  <div className={dividerClass} />
                  <div>
                    <p className={labelClass}>住所</p>
                    <p className={`${valueClass} mt-0.5`}>{site.address}</p>
                  </div>
                </>
              )}
              {site.contentRequest && (
                <>
                  <div className={dividerClass} />
                  <div>
                    <p className={labelClass}>依頼内容</p>
                    <p className={`${valueClass} mt-0.5 whitespace-pre-wrap`}>
                      {site.contentRequest}
                    </p>
                  </div>
                </>
              )}
              <div className={dividerClass} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelClass}>工期開始</p>
                  <p className={`${valueClass} mt-0.5`}>
                    {fmtDate(site.startDayRequest)}
                  </p>
                </div>
                <div>
                  <p className={labelClass}>工期終了</p>
                  <p className={`${valueClass} mt-0.5`}>
                    {fmtDate(site.endDayRequest)}
                  </p>
                </div>
              </div>
              {site.workCompany && (
                <>
                  <div className={dividerClass} />
                  <div>
                    <p className={labelClass}>施工会社</p>
                    <p className={`${valueClass} mt-0.5`}>{site.workCompany.name}</p>
                  </div>
                </>
              )}
              {site.deliveryDest && (
                <>
                  <div className={dividerClass} />
                  <div>
                    <p className={labelClass}>納品先</p>
                    <p className={`${valueClass} mt-0.5`}>{site.deliveryDest}</p>
                  </div>
                </>
              )}
              {site.remarks && (
                <>
                  <div className={dividerClass} />
                  <div>
                    <p className={labelClass}>備考</p>
                    <p className={`${valueClass} mt-0.5 whitespace-pre-wrap`}>
                      {site.remarks}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2. 金額情報 */}
          {hasFinancial && (
            <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-[14px] font-bold text-knock-text">金額情報</h3>
              </div>
              <div className="px-4 pb-4">
                {site.totalAmount != null && (() => {
                  const amt = Number(site.totalAmount);
                  const amtTax = Math.floor(amt * 0.1);
                  return (
                    <>
                      <div className={dividerClass} />
                      <div className="flex items-center justify-between">
                        <p className={labelClass}>小計</p>
                        <p className={valueClass}>{fmtAmount(amt)}</p>
                      </div>
                      <div className={dividerClass} />
                      <div className="flex items-center justify-between">
                        <p className={labelClass}>消費税（10%）</p>
                        <p className={valueClass}>{fmtAmount(amtTax)}</p>
                      </div>
                      <div className={dividerClass} />
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-bold text-knock-text">合計金額（税込）</p>
                        <p className="text-[16px] font-bold text-knock-accent">
                          {fmtAmount(amt + amtTax)}
                        </p>
                      </div>
                    </>
                  );
                })()}
                {site.totalAdvancePayment != null && (
                  <>
                    <div className={dividerClass} />
                    <div className="flex items-center justify-between">
                      <p className={labelClass}>前払金額</p>
                      <p className={`${valueClass} font-medium`}>
                        {fmtAmount(site.totalAdvancePayment)}
                      </p>
                    </div>
                  </>
                )}
                {site.expenses != null && (
                  <>
                    <div className={dividerClass} />
                    <div className="flex items-center justify-between">
                      <p className={labelClass}>経費</p>
                      <p className={`${valueClass} font-medium`}>
                        {fmtAmount(site.expenses)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 3. 支払条件 */}
          {hasPaymentTerms && (
            <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-[14px] font-bold text-knock-text">支払条件</h3>
              </div>
              <div className="px-4 pb-4">
                {site.paymentType != null && (
                  <>
                    <div className={dividerClass} />
                    <div>
                      <p className={labelClass}>支払タイプ</p>
                      <p className={`${valueClass} mt-0.5`}>
                        {PAYMENT_TYPE_LABELS[site.paymentType] ?? `タイプ${site.paymentType}`}
                      </p>
                    </div>
                  </>
                )}
                {(site.paymentLatterMonth != null || site.paymentLatterDay != null) && (
                  <>
                    <div className={dividerClass} />
                    <div className="grid grid-cols-2 gap-3">
                      {site.paymentLatterMonth != null && (
                        <div>
                          <p className={labelClass}>翌月数</p>
                          <p className={`${valueClass} mt-0.5`}>
                            {site.paymentLatterMonth}ヶ月
                          </p>
                        </div>
                      )}
                      {site.paymentLatterDay != null && (
                        <div>
                          <p className={labelClass}>支払日</p>
                          <p className={`${valueClass} mt-0.5`}>
                            {site.paymentLatterDay}日
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 4. 工種 */}
          {site.occupations && site.occupations.length > 0 && (
            <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-[14px] font-bold text-knock-text">
                  工種 ({site.occupations.length})
                </h3>
              </div>
              <div className="px-4 pb-4">
                <div className={dividerClass} />
                <div className="flex flex-wrap gap-2">
                  {site.occupations.map((occ) => (
                    <span
                      key={occ.id ?? occ.occupationSubItemId}
                      className="rounded-full bg-knock-accent/10 px-3 py-1.5 text-[12px] font-medium text-knock-accent"
                    >
                      {occ.occupationSubItem?.occupationMajorItem?.name && (
                        <span className="text-knock-text-secondary">
                          {occ.occupationSubItem.occupationMajorItem.name} /{" "}
                        </span>
                      )}
                      {occ.occupationSubItem?.name ?? occ.occupationSubItemId}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 5. 明細 */}
          {site.priceDetails && site.priceDetails.length > 0 && (
            <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-[14px] font-bold text-knock-text">
                  明細 ({site.priceDetails.length})
                </h3>
              </div>
              <div className="px-4 pb-4">
                <div className={dividerClass} />
                <div className="flex flex-col gap-2">
                  {site.priceDetails.map((detail) => {
                    const subtotal =
                      Math.ceil((detail.quantity ?? 0) * (Number(detail.priceUnit) || 0));
                    return (
                      <div
                        key={detail.id}
                        className="rounded-xl border border-gray-100 bg-gray-50/50 p-3"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-[13px] font-medium text-knock-text">
                            {detail.name}
                          </span>
                          <span className="text-[13px] font-bold text-knock-text">
                            {fmtAmount(subtotal)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-knock-text-secondary">
                          <span>
                            {detail.quantity} × {fmtAmount(Number(detail.priceUnit))}
                          </span>
                          {detail.unit && <span>{detail.unit.name}</span>}
                          {detail.specifications && (
                            <span className="truncate">
                              {detail.specifications}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* 合計 */}
                  {(() => {
                    const pdTax = Math.floor(priceDetailsSubtotal * 0.1);
                    return (
                      <div className="mt-1 rounded-xl bg-knock-accent/5 px-4 py-3">
                        <div className="flex justify-between text-[13px]">
                          <span className="text-gray-600">小計</span>
                          <span className="text-knock-text">{fmtAmount(priceDetailsSubtotal)}</span>
                        </div>
                        <div className="flex justify-between text-[13px]">
                          <span className="text-gray-600">消費税（10%）</span>
                          <span className="text-knock-text">{fmtAmount(pdTax)}</span>
                        </div>
                        <div className="mt-1 flex justify-between border-t border-gray-200/50 pt-1">
                          <span className="text-[13px] font-bold text-knock-text">合計金額（税込）</span>
                          <span className="text-[16px] font-bold text-knock-accent">
                            {fmtAmount(priceDetailsSubtotal + pdTax)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* 6. PDF */}
          {invoicePdfs.length > 0 && (
            <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-[14px] font-bold text-knock-text">PDF ({invoicePdfs.length})</h3>
              </div>
              <div className="px-4 pb-4">
                <div className={dividerClass} />
                <div className="flex flex-col gap-2">
                  {invoicePdfs.map((pdf, i) => (
                    <a
                      key={pdf.id}
                      href={pdf.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 transition-colors active:bg-gray-100"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M5 2H13L17 6V16C17 17.1 16.1 18 15 18H5C3.9 18 3 17.1 3 16V4C3 2.9 3.9 2 5 2Z"
                          stroke="#EF4444"
                          strokeWidth="1.2"
                          fill="none"
                        />
                        <text x="10" y="13" textAnchor="middle" fontSize="5" fill="#EF4444" fontWeight="bold">PDF</text>
                      </svg>
                      <span className="flex-1 text-[13px] text-knock-text">
                        見積書{invoicePdfs.length > 1 ? ` (${i + 1})` : ""}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 12L12 4M12 4H6M12 4V10" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7. メンバー（発注者のみ） */}
          {isOrderer && (
            <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-[14px] font-bold text-knock-text">
                  メンバー ({site.members.length})
                </h3>
              </div>
              <div className="px-4 pb-4">
                <div className={dividerClass} />
                {site.members.length === 0 ? (
                  <p className="text-[13px] text-knock-text-muted">
                    メンバーがいません
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {site.members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3">
                        {m.user.avatar ? (
                          <img
                            src={m.user.avatar}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-500">
                            {m.user.lastName?.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-[13px] font-medium text-knock-text">
                            {m.user.lastName} {m.user.firstName}
                          </p>
                          <p className="text-[11px] text-knock-text-secondary">
                            {m.user.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 8. 発注（発注者のみ） */}
          {isOrderer && (
            <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="px-4 pt-4 pb-1">
                <h3 className="text-[14px] font-bold text-knock-text">
                  発注 ({site.orders.length})
                </h3>
              </div>
              <div className="px-4 pb-4">
                <div className={dividerClass} />
                {site.orders.length === 0 ? (
                  <p className="text-[13px] text-knock-text-muted">
                    発注がありません
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {site.orders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 transition-colors active:bg-gray-100 active:scale-[0.98]"
                      >
                        <span className="text-[13px] text-knock-text">
                          {fmtDate(order.createdAt)}
                        </span>
                        <span className="text-[12px] font-medium text-knock-text-secondary">
                          {order.status ?? ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 発注アクションボタン（子現場のみ。親現場は管理用なので発注不要） */}
      {site.status === "NOT_ORDERED" && isOrderer && !isParentSite && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+60px)] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-4">
          <div className="flex flex-col gap-2 pb-3">
            <Link
              href={`/sites/${site.id}/order`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-4 text-[15px] font-bold text-white shadow-lg transition-all active:scale-[0.98]"
            >
              指定の業者に発注する
            </Link>
            <Link
              href={`/sites/${site.id}/post-job`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-500 bg-white py-3.5 text-[15px] font-bold text-blue-500 shadow-lg transition-all active:scale-[0.98]"
            >
              案件として掲載する
            </Link>
          </div>
        </div>
      )}

      {/* 画像プレビュー */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <img
            src={previewImage}
            alt="プレビュー"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="現場を削除"
        message="この現場を削除しますか？この操作は取り消せません。"
        confirmLabel={deleting ? "削除中..." : "削除"}
        cancelLabel="キャンセル"
        variant="danger"
      />
    </div>
  );
}
