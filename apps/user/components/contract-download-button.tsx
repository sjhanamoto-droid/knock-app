"use client";

import { useState } from "react";
import { getContractPdf } from "@/lib/actions/chat";

/**
 * 工事下請基本契約書のPDFをダウンロードするボタン。
 * サーバーアクションで data URI を生成し、Blob 経由でダウンロードする。
 */
export function ContractDownloadButton({ roomId }: { roomId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const dataUri = await getContractPdf(roomId);
      const res = await fetch(dataUri);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "工事下請基本契約書.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDFの生成に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white transition-opacity active:opacity-80 disabled:opacity-60"
      style={{ backgroundColor: "#E8960C" }}
    >
      {loading ? (
        "PDFを作成中..."
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2V11M9 11L5.5 7.5M9 11L12.5 7.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 13V14.5C3 15.33 3.67 16 4.5 16H13.5C14.33 16 15 15.33 15 14.5V13" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          PDFでダウンロード
        </>
      )}
    </button>
  );
}
