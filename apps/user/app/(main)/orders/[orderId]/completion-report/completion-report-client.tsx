"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getOrderDetail, submitCompletionReport } from "@/lib/actions/orders";
import { draftCompletionReport } from "@/lib/actions/ai";
import { ConfirmDialog, AlertDialog, useToast } from "@knock/ui";
import { formatCurrency } from "@knock/utils";
import { ImageLightbox } from "@/components/image-lightbox";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * 画像をクライアント側でリサイズ・JPEG圧縮する。base64化後のサーバーアクション
 * ボディが肥大して413になるのを防ぐ。失敗時(非画像/デコード不可)は null を返し、
 * 呼び出し側で元ファイルを使う。
 */
async function compressImage(file: File, maxDim = 1280, quality = 0.65): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    // 圧縮後が元より大きい場合は圧縮しない
    return blob && blob.size < file.size ? blob : null;
  } catch {
    return null;
  }
}

type OrderDetail = Awaited<ReturnType<typeof getOrderDetail>>;

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="60" height="6" viewBox="0 0 60 6" fill="none">
      <path
        d="M0 3 Q7.5 0 15 3 Q22.5 6 30 3 Q37.5 0 45 3 Q52.5 6 60 3"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

const cardClass = "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";

interface Props {
  initialOrder: OrderDetail;
  orderId: string;
  viewerCompanyId: string;
}

export function CompletionReportClient({ initialOrder, orderId, viewerCompanyId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { accentColor } = useMode();
  const [order, setOrder] = useState<OrderDetail | null>(initialOrder);
  const [submitting, setSubmitting] = useState(false);

  const [completionDate, setCompletionDate] = useState(
    initialOrder?.completionReport
      ? new Date(initialOrder.completionReport.completionDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [comment, setComment] = useState(initialOrder?.completionReport?.comment ?? "");
  const [photos, setPhotos] = useState<string[]>(
    (initialOrder?.completionReport?.photos as string[] | undefined) ?? []
  );
  const [uploading, setUploading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);

  async function refresh() {
    const updated = await getOrderDetail(orderId);
    setOrder(updated);
  }

  async function handleSubmitReport() {
    setShowReportConfirm(false);
    // 施工写真は /api/upload で Vercel Blob に保存済みで、photos には短いURLのみが入る。
    // サーバーアクションのボディに base64 を載せないため、ボディ上限による送信失敗は起きない。
    setSubmitting(true);
    try {
      await submitCompletionReport({
        factoryFloorOrderId: orderId,
        completionDate,
        comment: comment || undefined,
        photos,
      });
      await refresh();
      setSuccessMessage("施工報告を送信しました");
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const oversized = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      alert("10MBを超えるファイルがあります。サイズを確認してください。");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of Array.from(files)) {
        const compressed = await compressImage(f);
        if (compressed) {
          const name = (f.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
          formData.append("files", compressed, name);
        } else {
          formData.append("files", f);
        }
      }

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("アップロードに失敗しました");

      const data = await res.json();
      const urls: string[] = data.urls ?? data.files?.map((f: { url: string }) => f.url) ?? [];
      setPhotos(prev => [...prev, ...urls]);
    } catch {
      alert("写真のアップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  if (!order) {
    return <div className="p-4 text-center text-knock-text-muted">取引が見つかりません</div>;
  }

  const floor = order.factoryFloor;
  const isOrderer = floor.companyId === viewerCompanyId;
  const report = order.completionReport;
  const orderSheet = order.documents?.find((d) => d.type === "ORDER_SHEET");

  // 施工報告は締め完了(CLOSED)前まで提出/再提出可能
  const canEditReport = order.completionStatus !== "CLOSED";

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
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
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">施工報告</h1>
            <WavyUnderline color={accentColor} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        <div className="flex flex-col gap-0.5">
          {floor.parent && (
            <p className="text-[13px] text-knock-text-secondary">現場名: {floor.parent.name}</p>
          )}
          <p className="text-[13px] text-knock-text-secondary">
            {floor.parent ? "工事名: " : ""}{floor.name ?? ""} / {(isOrderer ? floor.workCompany?.name : floor.company?.name) ?? ""}
          </p>
        </div>

        {isOrderer || !canEditReport ? (
          /* ===== 発注者 / 受注者(完了後): 施工報告の確認（閲覧のみ） ===== */
          <>
            {/* 発注金額（注文書） */}
            {orderSheet && (
              <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
                <h3 className="mb-1 text-[12px] font-bold text-knock-text-secondary">発注金額（注文書）</h3>
                <p className="text-[20px] font-bold text-knock-text">
                  {orderSheet.totalAmount != null ? formatCurrency(Number(orderSheet.totalAmount)) : "-"}
                </p>
              </div>
            )}

            {/* 施工報告（任意・あれば表示） */}
            {report ? (
              <>
                <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
                  <h3 className="mb-1 text-[12px] font-bold text-knock-text-secondary">施工完了日</h3>
                  <p className="text-[14px] text-knock-text">
                    {new Date(report.completionDate).toLocaleDateString("ja-JP")}
                  </p>
                </div>

                {report.comment && (
                  <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
                    <h3 className="mb-1 text-[12px] font-bold text-knock-text-secondary">報告コメント</h3>
                    <p className="text-[14px] text-knock-text">{report.comment}</p>
                  </div>
                )}

                {(report.photos as string[]).length > 0 && (
                  <div className={`${cardClass} border-l-4`} style={{ borderLeftColor: accentColor }}>
                    <h3 className="mb-2 text-[12px] font-bold text-knock-text-secondary">
                      施工写真 ({(report.photos as string[]).length})
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {(report.photos as string[]).map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setViewer({ images: report.photos as string[], index: i })}
                          className="aspect-square overflow-hidden rounded-xl border border-gray-200 transition-all active:scale-95"
                        >
                          <img
                            src={url}
                            alt={`施工写真 ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={cardClass}>
                <p className="text-[13px] text-knock-text-secondary">施工報告はまだありません。</p>
              </div>
            )}
          </>
        ) : (
          /* ===== 受注者: 施工報告（任意） ===== */
          <>
            {canEditReport ? (
              <>
                {/* 施工完了日 */}
                <div>
                  <label className="mb-1 block text-[13px] font-bold text-knock-text">施工完了日</label>
                  <input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="w-full rounded-xl border-none bg-[#F0F0F0] px-4 py-3 text-[14px]"
                  />
                </div>

                {/* コメント */}
                <div>
                  <label className="mb-1 block text-[13px] font-bold text-knock-text">施工報告コメント</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="施工の報告を記入してください（任意）"
                    className="w-full rounded-xl border-none bg-[#F0F0F0] px-4 py-3 text-[14px]"
                  />
                  <button
                    type="button"
                    disabled={drafting || submitting || uploading}
                    onClick={async () => {
                      setDrafting(true);
                      try {
                        const r = await draftCompletionReport({
                          siteName: floor.name ?? "",
                          counterpartyName:
                            (isOrderer ? floor.workCompany?.name : floor.company?.name) ?? undefined,
                          completionDate,
                          photoCount: photos.length,
                          roughNotes: comment || undefined,
                        });
                        if ("error" in r) {
                          toast(r.error);
                        } else {
                          setComment(r.text);
                        }
                      } finally {
                        setDrafting(false);
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#F0F0F0] px-3 py-2 text-[13px] font-bold text-knock-text transition-colors active:bg-gray-200 disabled:opacity-50"
                  >
                    {drafting ? "生成中…" : "✨ AIで下書き"}
                  </button>
                </div>

                {/* 施工写真 */}
                <div>
                  <label className="mb-1 block text-[13px] font-bold text-knock-text">
                    施工写真（任意）
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-wrap gap-2">
                    {photos.map((url, i) => (
                      <div key={i} className="relative h-20 w-20">
                        <button
                          type="button"
                          onClick={() => setViewer({ images: photos, index: i })}
                          className="block h-full w-full overflow-hidden rounded-xl transition-all active:scale-95"
                        >
                          <img
                            src={url}
                            alt={`施工写真 ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-gray-400"
                    >
                      {uploading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                      ) : (
                        "+ 追加"
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setShowReportConfirm(true)}
                  disabled={submitting}
                  className="w-full rounded-xl border-2 py-3.5 text-[15px] font-bold transition-all active:scale-[0.97] disabled:opacity-50"
                  style={{ borderColor: accentColor, color: accentColor }}
                >
                  {submitting ? "送信中..." : report ? "施工報告を更新" : "施工報告を送信"}
                </button>
              </>
            ) : null}
          </>
        )}
      </div>

      <ConfirmDialog
        open={showReportConfirm}
        onClose={() => setShowReportConfirm(false)}
        onConfirm={handleSubmitReport}
        title="施工報告の送信"
        message="施工報告を送信しますか？"
        confirmLabel={submitting ? "送信中..." : "はい"}
        cancelLabel="いいえ"
        variant="primary"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => { setSuccessMessage(""); }}
        title="完了"
        message={successMessage}
      />

      {viewer && (
        <ImageLightbox
          images={viewer.images}
          index={viewer.index}
          onClose={() => setViewer(null)}
          fileNamePrefix="施工写真"
        />
      )}
    </div>
  );
}
