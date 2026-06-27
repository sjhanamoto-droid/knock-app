"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  /** 表示する画像URLの配列（Blob公開URL または data URI） */
  images: string[];
  /** 最初に表示する画像のインデックス */
  index: number;
  /** 閉じる */
  onClose: () => void;
  /** ダウンロード時のファイル名の接頭辞（例: 施工写真） */
  fileNamePrefix?: string;
}

/** URLから拡張子を推定（クエリ除去）。data URIにも対応。 */
function guessExt(url: string): string {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:image\/([a-zA-Z0-9.+-]+)/);
    if (m) return m[1].split("+")[0];
    return "jpg";
  }
  const path = url.split("?")[0];
  const m = path.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1] : "jpg";
}

/**
 * アップロード画像の拡大表示＋ダウンロード用のフルスクリーンビューア。
 * 複数枚なら前後にスワイプ/矢印で移動できる。
 * 画像は Blob 公開URL でも base64 データURI でもダウンロード可能（fetch→objectURL）。
 */
export function ImageLightbox({ images, index, onClose, fileNamePrefix = "image" }: Props) {
  const [current, setCurrent] = useState(index);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => setCurrent(index), [index]);

  const total = images.length;
  const url = images[current];

  const goPrev = useCallback(() => {
    setCurrent((c) => (c - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    setCurrent((c) => (c + 1) % total);
  }, [total]);

  // Escで閉じる / 矢印キーで移動 + 背景スクロール抑止
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && total > 1) goPrev();
      else if (e.key === "ArrowRight" && total > 1) goNext();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext, total]);

  async function handleDownload() {
    if (!url || downloading) return;
    setDownloading(true);
    const fileName = `${fileNamePrefix}_${current + 1}.${guessExt(url)}`;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      // CORS等で失敗したら新規タブで開く
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* 上部バー */}
      <div
        className="flex items-center justify-between px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[13px] font-medium text-white/80">
          {total > 1 ? `${current + 1} / ${total}` : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-bold text-white transition-all active:scale-95 disabled:opacity-50"
            aria-label="ダウンロード"
          >
            {downloading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2V10M8 10L5 7M8 10L11 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 11V12.5C3 13.05 3.45 13.5 4 13.5H12C12.55 13.5 13 13.05 13 12.5V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
            保存
          </button>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-all active:scale-95"
            aria-label="閉じる"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* 画像本体 */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`${fileNamePrefix} ${current + 1}`}
          className="max-h-full max-w-full object-contain select-none"
          draggable={false}
        />

        {total > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-all active:scale-95"
              aria-label="前へ"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-all active:scale-95"
              aria-label="次へ"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M8 4L14 10L8 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
