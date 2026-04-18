"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createFactoryFloorSchema,
  type CreateFactoryFloorInput,
} from "@knock/types";
import type { z } from "zod";

// zodResolver は input 型を使うため、フォームの型は input 型にする
type FormValues = z.input<typeof createFactoryFloorSchema>;
import { FileUpload } from "@knock/ui";
import OccupationSelector from "@/components/occupation-selector";
import type { ChildSiteInput } from "@/lib/actions/sites";

// 子現場フォーム用ローカル型（File オブジェクトを含む）
type ChildFormEntry = {
  name: string;
  code: string;
  contentRequest: string;
  address: string;
  startDayRequest: string;
  endDayRequest: string;
  occupations: { occupationSubItemId: string }[];
  priceDetails: {
    name: string;
    quantity: number;
    unitId?: string;
    priceUnit: number;
    specifications?: string;
  }[];
  drawingFiles: File[];
  photoFiles: File[];
  invoicePdfFiles: File[];
  expanded: boolean;
};

// ============ Types ============

type MajorItem = {
  id: string;
  name: string;
  subItems: { id: string; name: string }[];
};

type UnitOption = {
  id: string;
  name: string;
};

// getSite() の戻り値からプリフィルするための型
type SiteData = {
  id: string;
  name: string | null;
  code?: string | null;
  contentRequest?: string | null;
  address?: string | null;
  parentId?: string | null;
  budget?: number | bigint | null;
  startDayRequest?: string | Date | null;
  endDayRequest?: string | Date | null;
  occupations?: {
    occupationSubItemId: string;
    occupationSubItem?: {
      id: string;
      name: string;
      occupationMajorItem?: { id: string; name: string };
    };
  }[];
  priceDetails?: {
    id: string;
    name: string;
    quantity: number;
    unitId?: string | null;
    priceUnit: number | bigint;
    specifications?: string | null;
  }[];
  images?: { id: string; url: string; type: number }[];
  pdfs?: { id: string; url: string; type: number }[];
  children?: {
    id: string;
    name: string | null;
    status: string;
    totalAmount?: number | bigint | null;
    contentRequest?: string | null;
    startDayRequest?: string | Date | null;
    endDayRequest?: string | Date | null;
    workCompany?: { id: string; name: string | null } | null;
  }[];
};

interface SiteFormProps {
  mode: "create" | "edit";
  initialData?: SiteData;
  onSubmit: (
    data: CreateFactoryFloorInput & {
      imageDrawingUrls?: string[];
      imagePhotoUrls?: string[];
      pdfInvoiceUrls?: string[];
      deletedPriceDetailIds?: string[];
      deletedImageIds?: string[];
      deletedPdfIds?: string[];
      children?: ChildSiteInput[];
    }
  ) => Promise<void>;
  occupationMasters: MajorItem[];
  units: UnitOption[];
  parentId?: string;
}

// ============ Helpers ============

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "";
  return n.toLocaleString("ja-JP");
}

// ============ Styles ============

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] text-knock-text placeholder:text-gray-400 focus:border-knock-accent focus:outline-none focus:ring-1 focus:ring-knock-accent";

const labelClass = "mb-1.5 block text-[13px] font-medium text-gray-700";

const sectionTitleClass =
  "mb-3 text-[13px] font-bold uppercase tracking-wider text-knock-text-secondary";

const cardClass =
  "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";

// ============ Component ============

export default function SiteForm({
  mode,
  initialData,
  onSubmit,
  occupationMasters,
  units,
  parentId,
}: SiteFormProps) {
  const isChildSite = !!parentId;
  const isParentSite = !isChildSite;
  const isParentCreate = isParentSite && mode === "create";
  const [formTab, setFormTab] = useState<"overview" | "children">("overview");
  const [childEntries, setChildEntries] = useState<ChildFormEntry[]>([]);

  // 子現場エントリ更新ヘルパー
  function updateChild(idx: number, updates: Partial<ChildFormEntry>) {
    setChildEntries((prev) => prev.map((c, i) => (i === idx ? { ...c, ...updates } : c)));
  }

  // 子現場の明細合計を計算
  function getChildTotal(child: ChildFormEntry): number {
    return child.priceDetails.reduce((sum, d) => {
      return sum + Math.ceil((Number(d.quantity) || 0) * (Number(d.priceUnit) || 0));
    }, 0);
  }
  const [serverError, setServerError] = useState("");
  const [deletedPriceDetailIds, setDeletedPriceDetailIds] = useState<string[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [deletedPdfIds, setDeletedPdfIds] = useState<string[]>([]);

  // 新規ファイル
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [invoicePdfFiles, setInvoicePdfFiles] = useState<File[]>([]);

  // 既存ファイル（edit時）
  const [existingDrawings, setExistingDrawings] = useState(
    initialData?.images?.filter((img) => img.type === 1) ?? []
  );
  const [existingPhotos, setExistingPhotos] = useState(
    initialData?.images?.filter((img) => img.type === 2) ?? []
  );
  const [existingInvoicePdfs, setExistingInvoicePdfs] = useState(
    initialData?.pdfs?.filter((pdf) => pdf.type === 1) ?? []
  );

  const defaultPriceDetails =
    initialData?.priceDetails?.map((d) => ({
      id: d.id,
      name: d.name,
      quantity: d.quantity,
      unitId: d.unitId ?? undefined,
      priceUnit: Number(d.priceUnit),
      specifications: d.specifications ?? undefined,
    })) ?? [];

  const defaultOccupations =
    initialData?.occupations?.map((o) => ({
      occupationSubItemId: o.occupationSubItemId,
    })) ?? [];

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createFactoryFloorSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      code: initialData?.code ?? "",
      contentRequest: initialData?.contentRequest ?? "",
      address: initialData?.address ?? "",
      startDayRequest: formatDate(initialData?.startDayRequest),
      endDayRequest: formatDate(initialData?.endDayRequest),
      occupations: defaultOccupations,
      priceDetails: defaultPriceDetails,
      parentId: parentId ?? undefined,
      budget: initialData?.budget != null ? Number(initialData.budget) : "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "priceDetails",
  });

  const priceDetails = watch("priceDetails") ?? [];

  // 小計計算
  const subtotals = priceDetails.map((d: { quantity?: number; priceUnit?: number }) => {
    const qty = Number(d?.quantity) || 0;
    const price = Number(d?.priceUnit) || 0;
    return Math.ceil(qty * price);
  });
  const grandTotal = subtotals.reduce((sum: number, v: number) => sum + v, 0);

  // 画像削除
  function removeExistingImage(id: string, type: number) {
    setDeletedImageIds((prev) => [...prev, id]);
    if (type === 1) {
      setExistingDrawings((prev) => prev.filter((img) => img.id !== id));
    } else {
      setExistingPhotos((prev) => prev.filter((img) => img.id !== id));
    }
  }

  // PDF削除
  function removeExistingPdf(id: string) {
    setDeletedPdfIds((prev) => [...prev, id]);
    setExistingInvoicePdfs((prev) => prev.filter((pdf) => pdf.id !== id));
  }

  // 明細行削除
  function removePriceDetail(index: number) {
    const detail = fields[index];
    if (detail && "id" in detail && typeof (detail as Record<string, unknown>).id === "string") {
      // react-hook-form の内部 id ではなく、DB の id を追跡
      const dbId = priceDetails[index]?.id;
      if (dbId) {
        setDeletedPriceDetailIds((prev) => [...prev, dbId]);
      }
    }
    remove(index);
  }

  async function uploadFiles(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error("ファイルのアップロードに失敗しました");
    const json = await res.json();
    return json.urls as string[];
  }

  async function onFormSubmit(data: FormValues) {
    setServerError("");
    try {
      const parsed = data as unknown as CreateFactoryFloorInput;

      // ファイルをアップロードしてURLを取得
      const [imageDrawingUrls, imagePhotoUrls, pdfInvoiceUrls] =
        await Promise.all([
          uploadFiles(drawingFiles),
          uploadFiles(photoFiles),
          uploadFiles(invoicePdfFiles),
        ]);

      await onSubmit({
        ...parsed,
        imageDrawingUrls: imageDrawingUrls.length > 0 ? imageDrawingUrls : undefined,
        imagePhotoUrls: imagePhotoUrls.length > 0 ? imagePhotoUrls : undefined,
        pdfInvoiceUrls: pdfInvoiceUrls.length > 0 ? pdfInvoiceUrls : undefined,
        deletedPriceDetailIds:
          deletedPriceDetailIds.length > 0 ? deletedPriceDetailIds : undefined,
        deletedImageIds:
          deletedImageIds.length > 0 ? deletedImageIds : undefined,
        deletedPdfIds:
          deletedPdfIds.length > 0 ? deletedPdfIds : undefined,
        ...(isParentSite && childEntries.length > 0
          ? {
              children: await Promise.all(
                childEntries
                  .filter((c) => c.name.trim())
                  .map(async (child) => {
                    const [cDrawingUrls, cPhotoUrls, cPdfUrls] = await Promise.all([
                      uploadFiles(child.drawingFiles),
                      uploadFiles(child.photoFiles),
                      uploadFiles(child.invoicePdfFiles),
                    ]);
                    const childTotal = getChildTotal(child);
                    return {
                      name: child.name,
                      code: child.code || undefined,
                      contentRequest: child.contentRequest || undefined,
                      address: child.address || undefined,
                      startDayRequest: child.startDayRequest || undefined,
                      endDayRequest: child.endDayRequest || undefined,
                      totalAmount: childTotal > 0 ? childTotal : undefined,
                      occupations: child.occupations.length > 0 ? child.occupations : undefined,
                      priceDetails: child.priceDetails.length > 0 ? child.priceDetails : undefined,
                      imageDrawingUrls: cDrawingUrls.length > 0 ? cDrawingUrls : undefined,
                      imagePhotoUrls: cPhotoUrls.length > 0 ? cPhotoUrls : undefined,
                      pdfInvoiceUrls: cPdfUrls.length > 0 ? cPdfUrls : undefined,
                    } as ChildSiteInput;
                  })
              ),
            }
          : {}),
      } as Parameters<typeof onSubmit>[0]);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "エラーが発生しました"
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      className="flex flex-col gap-4 px-4 pb-8"
    >
      {serverError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-600">
          {serverError}
        </div>
      )}

      {/* parentId hidden field */}
      {parentId && <input type="hidden" {...register("parentId")} />}

      {/* タブ切替（親現場のみ） */}
      {isParentSite && (
        <div className="flex gap-1 rounded-full bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setFormTab("overview")}
            className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
              formTab === "overview"
                ? "bg-knock-text text-white shadow-sm"
                : "text-gray-500"
            }`}
          >
            概要
          </button>
          <button
            type="button"
            onClick={() => setFormTab("children")}
            className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
              formTab === "children"
                ? "bg-knock-text text-white shadow-sm"
                : "text-gray-500"
            }`}
          >
            工事一覧
            {(() => {
              const existingCount = initialData?.children?.length ?? 0;
              const total = existingCount + childEntries.length;
              return total > 0 ? ` (${total})` : "";
            })()}
          </button>
        </div>
      )}

      {/* ======== 工事一覧タブ（親現場） ======== */}
      {isParentSite && formTab === "children" && (
        <>
          {/* 既存の子現場（編集時） */}
          {mode === "edit" && initialData?.children && initialData.children.length > 0 && (
            <>
              <p className={sectionTitleClass}>登録済みの工事</p>
              {initialData.children.map((child) => {
                const statusLabels: Record<string, { label: string; color: string }> = {
                  NOT_ORDERED: { label: "未発注", color: "text-gray-500 bg-gray-100" },
                  ORDER_REQUESTED: { label: "発注依頼中", color: "text-yellow-700 bg-yellow-50" },
                  ORDERED: { label: "発注済", color: "text-blue-700 bg-blue-50" },
                  CONFIRMED: { label: "受注確認", color: "text-blue-700 bg-blue-50" },
                  WORKING: { label: "施工中", color: "text-knock-accent bg-knock-accent/10" },
                  COMPLETED: { label: "完了", color: "text-green-700 bg-green-50" },
                  INSPECTED: { label: "検収済", color: "text-green-700 bg-green-50" },
                };
                const s = statusLabels[child.status] ?? { label: child.status, color: "text-gray-500 bg-gray-100" };
                return (
                  <div key={child.id} className={cardClass}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[14px] font-bold text-knock-text">{child.name || "未設定"}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.color}`}>
                        {s.label}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-[12px] text-gray-500">
                      {child.workCompany?.name && (
                        <p>業者: {child.workCompany.name}</p>
                      )}
                      {child.totalAmount != null && Number(child.totalAmount) > 0 && (
                        <p>金額: {Number(child.totalAmount).toLocaleString("ja-JP")}円</p>
                      )}
                      {(child.startDayRequest || child.endDayRequest) && (
                        <p>
                          工期: {child.startDayRequest ? formatDate(child.startDayRequest) : "—"} 〜 {child.endDayRequest ? formatDate(child.endDayRequest) : "—"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* 新規追加セクション */}
          {mode === "edit" && childEntries.length === 0 && (
            <p className={sectionTitleClass}>工事を追加</p>
          )}
          {mode === "edit" && childEntries.length > 0 && (
            <p className={sectionTitleClass}>追加する工事</p>
          )}

          <button
            type="button"
            onClick={() =>
              setChildEntries([
                ...childEntries,
                {
                  name: "", code: "", contentRequest: "", address: "",
                  startDayRequest: "", endDayRequest: "",
                  occupations: [], priceDetails: [],
                  drawingFiles: [], photoFiles: [], invoicePdfFiles: [],
                  expanded: true,
                },
              ])
            }
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 py-4 text-[14px] font-bold text-gray-500 transition-all active:scale-[0.98] active:border-gray-400"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 3V15M3 9H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            工事を追加
          </button>

          {childEntries.map((child, idx) => {
            const childTotal = getChildTotal(child);
            return (
              <div key={idx} className={cardClass}>
                {/* ヘッダー（展開/折りたたみ） */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => updateChild(idx, { expanded: !child.expanded })}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <svg
                      width="12" height="12" viewBox="0 0 12 12" fill="none"
                      className={`transition-transform ${child.expanded ? "rotate-90" : ""}`}
                    >
                      <path d="M4 2L8 6L4 10" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[14px] font-bold text-knock-text">
                      工事 #{idx + 1}{child.name ? ` - ${child.name}` : ""}
                    </span>
                  </button>
                  {!child.expanded && childTotal > 0 && (
                    <span className="text-[12px] font-bold text-knock-accent mr-3">
                      {childTotal.toLocaleString("ja-JP")}円
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setChildEntries(childEntries.filter((_, i) => i !== idx))}
                    className="text-[12px] text-knock-red"
                  >
                    削除
                  </button>
                </div>

                {/* 展開時の詳細フォーム */}
                {child.expanded && (
                  <div className="mt-4 flex flex-col gap-4">
                    {/* 基本情報 */}
                    <div>
                      <p className={sectionTitleClass}>基本情報</p>
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className={labelClass}>工事名 <span className="text-knock-red">*</span></label>
                          <input
                            value={child.name}
                            onChange={(e) => updateChild(idx, { name: e.target.value })}
                            className={inputClass}
                            placeholder="例: 電気工事"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>現場コード</label>
                          <input
                            value={child.code}
                            onChange={(e) => updateChild(idx, { code: e.target.value })}
                            className={inputClass}
                            placeholder="例: SJ-2026-001"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>依頼内容</label>
                          <textarea
                            value={child.contentRequest}
                            onChange={(e) => updateChild(idx, { contentRequest: e.target.value })}
                            rows={2}
                            className={inputClass}
                            placeholder="工事内容を入力"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 場所情報 */}
                    <div>
                      <p className={sectionTitleClass}>場所情報</p>
                      <div>
                        <label className={labelClass}>住所</label>
                        <input
                          value={child.address}
                          onChange={(e) => updateChild(idx, { address: e.target.value })}
                          className={inputClass}
                          placeholder="東京都新宿区..."
                        />
                      </div>
                    </div>

                    {/* 日程 */}
                    <div>
                      <p className={sectionTitleClass}>日程</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>工期開始</label>
                          <input
                            type="date"
                            value={child.startDayRequest}
                            onChange={(e) => updateChild(idx, { startDayRequest: e.target.value })}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>工期終了</label>
                          <input
                            type="date"
                            value={child.endDayRequest}
                            onChange={(e) => updateChild(idx, { endDayRequest: e.target.value })}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 工種 */}
                    {occupationMasters.length > 0 && (
                      <div>
                        <p className={sectionTitleClass}>工種</p>
                        <OccupationSelector
                          masters={occupationMasters}
                          value={child.occupations}
                          onChange={(val) => updateChild(idx, { occupations: val })}
                        />
                      </div>
                    )}

                    {/* 明細 */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <p className={sectionTitleClass + " mb-0"}>明細</p>
                        <button
                          type="button"
                          onClick={() => {
                            const details = [...child.priceDetails, { name: "", quantity: 1, priceUnit: 0 }];
                            updateChild(idx, { priceDetails: details });
                          }}
                          className="rounded-lg bg-knock-accent/10 px-3 py-1.5 text-[12px] font-bold text-knock-accent transition-colors active:bg-knock-accent/20"
                        >
                          + 行を追加
                        </button>
                      </div>
                      {child.priceDetails.length === 0 ? (
                        <p className="py-4 text-center text-[13px] text-gray-400">明細行がありません</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {child.priceDetails.map((detail, dIdx) => {
                            const subtotal = Math.ceil((Number(detail.quantity) || 0) * (Number(detail.priceUnit) || 0));
                            return (
                              <div key={dIdx} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-[12px] font-bold text-gray-500">#{dIdx + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const details = child.priceDetails.filter((_, i) => i !== dIdx);
                                      updateChild(idx, { priceDetails: details });
                                    }}
                                    className="text-[12px] text-knock-red"
                                  >
                                    削除
                                  </button>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <div>
                                    <label className="mb-1 block text-[11px] font-medium text-gray-500">
                                      項目名 <span className="text-knock-red">*</span>
                                    </label>
                                    <input
                                      value={detail.name}
                                      onChange={(e) => {
                                        const details = [...child.priceDetails];
                                        details[dIdx] = { ...details[dIdx], name: e.target.value };
                                        updateChild(idx, { priceDetails: details });
                                      }}
                                      className={inputClass}
                                      placeholder="例: 配線工事"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="mb-1 block text-[11px] font-medium text-gray-500">数量</label>
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={detail.quantity}
                                        onChange={(e) => {
                                          const details = [...child.priceDetails];
                                          details[dIdx] = { ...details[dIdx], quantity: Number(e.target.value) || 0 };
                                          updateChild(idx, { priceDetails: details });
                                        }}
                                        className={inputClass}
                                        min="0.1"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-[11px] font-medium text-gray-500">単位</label>
                                      <select
                                        value={detail.unitId ?? ""}
                                        onChange={(e) => {
                                          const details = [...child.priceDetails];
                                          details[dIdx] = { ...details[dIdx], unitId: e.target.value || undefined };
                                          updateChild(idx, { priceDetails: details });
                                        }}
                                        className={inputClass}
                                      >
                                        <option value="">-</option>
                                        {units.map((u) => (
                                          <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-[11px] font-medium text-gray-500">単価</label>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        value={detail.priceUnit}
                                        onChange={(e) => {
                                          const details = [...child.priceDetails];
                                          details[dIdx] = { ...details[dIdx], priceUnit: Number(e.target.value) || 0 };
                                          updateChild(idx, { priceDetails: details });
                                        }}
                                        className={`${inputClass} pr-8`}
                                        placeholder="0"
                                        min="0"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">円</span>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-[11px] font-medium text-gray-500">仕様</label>
                                    <input
                                      value={detail.specifications ?? ""}
                                      onChange={(e) => {
                                        const details = [...child.priceDetails];
                                        details[dIdx] = { ...details[dIdx], specifications: e.target.value || undefined };
                                        updateChild(idx, { priceDetails: details });
                                      }}
                                      className={inputClass}
                                      placeholder="仕様・備考"
                                    />
                                  </div>
                                  <div className="mt-1 text-right text-[13px] font-bold text-knock-text">
                                    小計: {formatNumber(subtotal)}円
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div className="rounded-xl bg-knock-accent/5 px-4 py-3 text-right">
                            <span className="text-[13px] text-gray-600">合計: </span>
                            <span className="text-[16px] font-bold text-knock-accent">
                              {formatNumber(childTotal)}円
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 画像 */}
                    <div>
                      <p className={sectionTitleClass}>画像</p>
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className={labelClass}>図面</label>
                          <FileUpload
                            accept="image/*"
                            multiple
                            maxFiles={10}
                            label="図面を追加"
                            onChange={(files) => updateChild(idx, { drawingFiles: files })}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>写真</label>
                          <FileUpload
                            accept="image/*"
                            multiple
                            maxFiles={10}
                            label="写真を追加"
                            onChange={(files) => updateChild(idx, { photoFiles: files })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* PDF */}
                    <div>
                      <p className={sectionTitleClass}>PDF</p>
                      <div>
                        <label className={labelClass}>見積書</label>
                        <FileUpload
                          accept=".pdf"
                          multiple
                          maxFiles={5}
                          label="見積書を追加"
                          onChange={(files) => updateChild(idx, { invoicePdfFiles: files })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* サマリー */}
          {(() => {
            const existingCount = initialData?.children?.length ?? 0;
            const existingTotal = initialData?.children?.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0) ?? 0;
            const newCount = childEntries.filter((c) => c.name.trim()).length;
            const newTotal = childEntries.reduce((sum, c) => sum + getChildTotal(c), 0);
            const totalCount = existingCount + newCount;
            const totalAmount = existingTotal + newTotal;
            if (totalCount === 0) return null;
            return (
              <div className="rounded-xl bg-knock-accent/5 px-4 py-3">
                <div className="flex justify-between text-[13px]">
                  <span className="text-gray-600">工事数</span>
                  <span className="font-bold text-knock-text">{totalCount}件</span>
                </div>
                <div className="flex justify-between text-[13px] mt-1">
                  <span className="text-gray-600">発注合計</span>
                  <span className="font-bold text-knock-accent">
                    {totalAmount.toLocaleString("ja-JP")}円
                  </span>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ======== 概要タブの内容（親現場はタブ切替、子現場は常時表示） ======== */}
      {(!isParentSite || formTab === "overview") && <>

      {/* ======== 1. 基本情報 ======== */}
      <div className={cardClass}>
        <p className={sectionTitleClass}>基本情報</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>
              {isChildSite ? "工事名" : "現場名"} <span className="text-knock-red">*</span>
            </label>
            <input
              {...register("name")}
              className={inputClass}
              placeholder={isChildSite ? "例: 電気工事" : "例: 新宿オフィスビル改修工事"}
            />
            {errors.name && (
              <p className="mt-1 text-[12px] text-knock-red">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>現場コード</label>
            <input
              {...register("code")}
              className={inputClass}
              placeholder="例: SJ-2026-001"
            />
          </div>

          {/* 全体予算（親現場のみ） */}
          {!isChildSite && (
            <div>
              <label className={labelClass}>全体予算（受注金額）</label>
              <div className="relative">
                <input
                  type="number"
                  {...register("budget")}
                  className={`${inputClass} pr-8`}
                  placeholder="0"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">
                  円
                </span>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>依頼内容</label>
            <textarea
              {...register("contentRequest")}
              rows={3}
              className={inputClass}
              placeholder="工事内容・依頼内容を入力"
            />
          </div>

        </div>
      </div>

      {/* ======== 2. 場所情報 ======== */}
      <div className={cardClass}>
        <p className={sectionTitleClass}>場所情報</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>住所</label>
            <input
              {...register("address")}
              className={inputClass}
              placeholder="東京都新宿区..."
            />
          </div>

        </div>
      </div>

      {/* ======== 3. 日程 ======== */}
      <div className={cardClass}>
        <p className={sectionTitleClass}>日程</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>工期開始</label>
            <input
              type="date"
              {...register("startDayRequest")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>工期終了</label>
            <input
              type="date"
              {...register("endDayRequest")}
              className={inputClass}
            />
          </div>
        </div>
      </div>


      {/* ======== 6. 工種選択（子現場のみ） ======== */}
      {isChildSite && occupationMasters.length > 0 && (
        <div className={cardClass}>
          <p className={sectionTitleClass}>工種</p>
          <Controller
            name="occupations"
            control={control}
            render={({ field }) => (
              <OccupationSelector
                masters={occupationMasters}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      )}

      {/* ======== 7. 明細（子現場のみ） ======== */}
      {isChildSite && <div className={cardClass}>
        <div className="mb-3 flex items-center justify-between">
          <p className={sectionTitleClass + " mb-0"}>明細</p>
          <button
            type="button"
            onClick={() =>
              append({
                name: "",
                quantity: 1,
                priceUnit: 0,
                unitId: undefined,
                specifications: undefined,
              })
            }
            className="rounded-lg bg-knock-accent/10 px-3 py-1.5 text-[12px] font-bold text-knock-accent transition-colors active:bg-knock-accent/20"
          >
            + 行を追加
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-gray-400">
            明細行がありません
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-xl border border-gray-200 bg-gray-50/50 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-gray-500">
                    #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePriceDetail(index)}
                    className="text-[12px] text-knock-red"
                  >
                    削除
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">
                      項目名 <span className="text-knock-red">*</span>
                    </label>
                    <input
                      {...register(`priceDetails.${index}.name`)}
                      className={inputClass}
                      placeholder="例: 塗装工事"
                    />
                    {errors.priceDetails?.[index]?.name && (
                      <p className="mt-0.5 text-[11px] text-knock-red">
                        {errors.priceDetails[index].name?.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-500">
                        数量
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        {...register(`priceDetails.${index}.quantity`)}
                        className={inputClass}
                        min="0.1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-500">
                        単位
                      </label>
                      <select
                        {...register(`priceDetails.${index}.unitId`)}
                        className={inputClass}
                      >
                        <option value="">-</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">
                      単価
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        {...register(`priceDetails.${index}.priceUnit`)}
                        className={`${inputClass} pr-8`}
                        placeholder="0"
                        min="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">
                        円
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">
                      仕様
                    </label>
                    <input
                      {...register(`priceDetails.${index}.specifications`)}
                      className={inputClass}
                      placeholder="仕様・備考"
                    />
                  </div>

                  {/* 小計 */}
                  <div className="mt-1 text-right text-[13px] font-bold text-knock-text">
                    小計: {formatNumber(subtotals[index])}円
                  </div>
                </div>
              </div>
            ))}

            {/* 合計 */}
            <div className="rounded-xl bg-knock-accent/5 px-4 py-3 text-right">
              <span className="text-[13px] text-gray-600">合計: </span>
              <span className="text-[16px] font-bold text-knock-accent">
                {formatNumber(grandTotal)}円
              </span>
            </div>
          </div>
        )}
      </div>}

      {/* ======== 8. 画像 ======== */}
      <div className={cardClass}>
        <p className={sectionTitleClass}>画像</p>
        <div className="flex flex-col gap-4">
          {/* 図面 */}
          <div>
            <label className={labelClass}>図面</label>
            {existingDrawings.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {existingDrawings.map((img) => (
                  <div key={img.id} className="relative">
                    <img
                      src={img.url}
                      alt="図面"
                      className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(img.id, 1)}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <FileUpload
              accept="image/*"
              multiple
              maxFiles={10}
              label="図面を追加"
              onChange={setDrawingFiles}
            />
          </div>

          {/* 写真 */}
          <div>
            <label className={labelClass}>写真</label>
            {existingPhotos.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {existingPhotos.map((img) => (
                  <div key={img.id} className="relative">
                    <img
                      src={img.url}
                      alt="写真"
                      className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(img.id, 2)}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <FileUpload
              accept="image/*"
              multiple
              maxFiles={10}
              label="写真を追加"
              onChange={setPhotoFiles}
            />
          </div>
        </div>
      </div>

      {/* ======== 9. PDF ======== */}
      <div className={cardClass}>
        <p className={sectionTitleClass}>PDF</p>
        <div className="flex flex-col gap-4">
          {/* 見積書 */}
          <div>
            <label className={labelClass}>見積書</label>
            {existingInvoicePdfs.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {existingInvoicePdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M4 1H10L14 5V13C14 14.1 13.1 15 12 15H4C2.9 15 2 14.1 2 13V3C2 1.9 2.9 1 4 1Z"
                          stroke="#EF4444"
                          strokeWidth="1.2"
                          fill="none"
                        />
                        <text
                          x="8"
                          y="11"
                          textAnchor="middle"
                          fontSize="5"
                          fill="#EF4444"
                          fontWeight="bold"
                        >
                          PDF
                        </text>
                      </svg>
                      <span className="text-[12px] text-gray-600 truncate max-w-[200px]">
                        見積書
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExistingPdf(pdf.id)}
                      className="text-[12px] text-knock-red"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
            <FileUpload
              accept=".pdf"
              multiple
              maxFiles={5}
              label="見積書を追加"
              onChange={setInvoicePdfFiles}
            />
          </div>

        </div>
      </div>

      </>}

      {/* ======== 送信ボタン ======== */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-xl bg-knock-accent py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {isSubmitting
          ? mode === "create"
            ? isChildSite ? "追加中..." : "作成中..."
            : "更新中..."
          : mode === "create"
            ? isChildSite ? "工事を追加" : "プロジェクトを作成"
            : "変更を保存"}
      </button>
    </form>
  );
}
