"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getDocumentDetail } from "@/lib/actions/documents";
import {
  documentTypeLabels,
  documentStatusLabels,
  documentStatusColors,
} from "@knock/utils";
import { formatCurrency } from "@knock/utils";

function downloadDataUrlAsPdf(dataUrl: string, filename: string) {
  // data URL を Blob に変換してダウンロード
  const byteString = atob(dataUrl.split(",")[1] ?? "");
  const mimeString = dataUrl.split(",")[0]?.split(":")[1]?.split(";")[0] ?? "application/pdf";
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeString });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="60" height="6" viewBox="0 0 60 6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 3 Q7.5 0 15 3 Q22.5 6 30 3 Q37.5 0 45 3 Q52.5 6 60 3"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

type DocumentDetail = Awaited<ReturnType<typeof getDocumentDetail>>;

export default function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const router = useRouter();
  const { accentColor } = useMode();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocumentDetail(documentId)
      .then(setDoc)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!doc) {
    return <div className="p-4 text-center text-knock-text-muted">帳票が見つかりません</div>;
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">帳票詳細</h1>
            <WavyUnderline color={accentColor} />
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              documentStatusColors[doc.status] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {documentStatusLabels[doc.status] ?? ""}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-[18px] font-bold text-knock-text">
            {documentTypeLabels[doc.type]}
          </h2>
          <p className="mt-1 text-[13px] text-knock-text-secondary">
            No. {doc.documentNumber}
          </p>
          {doc.issuedAt && (
            <p className="text-[12px] text-knock-text-muted">
              発行日: {new Date(doc.issuedAt).toLocaleDateString("ja-JP")}
            </p>
          )}
        </div>

        {/* 発注者情報 */}
        <div
          className="rounded-2xl border-l-4 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
          style={{ borderLeftColor: accentColor }}
        >
          <h3 className="mb-2 text-[12px] font-bold text-knock-text-secondary">発注者</h3>
          <p className="text-[14px] font-semibold text-knock-text">{doc.orderCompany.name}</p>
          {doc.orderCompany.postalCode && (
            <p className="text-[12px] text-knock-text-secondary">
              〒{doc.orderCompany.postalCode} {doc.orderCompany.prefecture}{doc.orderCompany.city}{doc.orderCompany.streetAddress}{doc.orderCompany.building ?? ""}
            </p>
          )}
        </div>

        {/* 受注者情報 */}
        <div
          className="rounded-2xl border-l-4 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
          style={{ borderLeftColor: accentColor }}
        >
          <h3 className="mb-2 text-[12px] font-bold text-knock-text-secondary">受注者</h3>
          <p className="text-[14px] font-semibold text-knock-text">{doc.workerCompany.name}</p>
          {doc.workerCompany.invoiceNumber && (
            <p className="text-[12px] text-knock-blue">
              インボイス番号: {doc.workerCompany.invoiceNumber}
            </p>
          )}
        </div>

        {/* 金額 */}
        <div
          className="rounded-2xl border-l-4 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
          style={{ borderLeftColor: accentColor }}
        >
          <h3 className="mb-2 text-[12px] font-bold text-knock-text-secondary">金額</h3>
          <div className="flex flex-col gap-1 text-[14px]">
            {doc.subtotal != null && (
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">小計</span>
                <span>{formatCurrency(doc.subtotal)}</span>
              </div>
            )}
            {doc.taxAmount != null && (
              <div className="flex justify-between">
                <span className="text-knock-text-secondary">消費税（10%）</span>
                <span>{formatCurrency(doc.taxAmount)}</span>
              </div>
            )}
            {doc.totalAmount != null && (
              <div className="mt-1 flex justify-between border-t pt-1">
                <span className="font-bold">合計</span>
                <span className="text-[16px] font-bold" style={{ color: accentColor }}>
                  {formatCurrency(doc.totalAmount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 現場情報 */}
        {doc.factoryFloorOrder?.factoryFloor && (
          <div
            className="rounded-2xl border-l-4 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
            style={{ borderLeftColor: accentColor }}
          >
            <h3 className="mb-2 text-[12px] font-bold text-knock-text-secondary">現場</h3>
            <p className="text-[14px] font-semibold text-knock-text">
              {doc.factoryFloorOrder.factoryFloor.name}
            </p>
            <p className="text-[12px] text-knock-text-secondary">
              {doc.factoryFloorOrder.factoryFloor.address}
            </p>
          </div>
        )}

        {/* PDF ダウンロード */}
        {doc.pdfUrl ? (
          doc.pdfUrl.startsWith("data:") ? (
            <button
              onClick={() => {
                const filename = `${documentTypeLabels[doc.type] ?? "帳票"}_${doc.documentNumber}.pdf`;
                downloadDataUrlAsPdf(doc.pdfUrl!, filename);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97]"
              style={{ backgroundColor: accentColor }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path d="M8 2V10M8 10L5 7M8 10L11 7M3 13H13" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              PDFをダウンロード
            </button>
          ) : (
            <a
              href={doc.pdfUrl}
              download={`${documentTypeLabels[doc.type] ?? "帳票"}_${doc.documentNumber}.pdf`}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97]"
              style={{ backgroundColor: accentColor }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path d="M8 2V10M8 10L5 7M8 10L11 7M3 13H13" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              PDFをダウンロード
            </a>
          )
        ) : (
          <div className="rounded-xl bg-gray-100 py-8 text-center">
            <p className="text-[13px] text-knock-text-muted">PDF生成中です...</p>
          </div>
        )}
      </div>
    </div>
  );
}
