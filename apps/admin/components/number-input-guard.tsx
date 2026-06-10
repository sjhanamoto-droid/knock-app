"use client";

import { useEffect } from "react";

/**
 * 数値入力(type="number")の誤操作による値のズレを防ぐグローバルガード。
 * - スクロール中はフォーカス中の数値入力を blur し、ホイールでの増減を防ぐ
 * - 上下キーでのステップ(増減)を無効化する
 * スピナー矢印の非表示は globals.css 側で行う。
 */
export function NumberInputGuard() {
  useEffect(() => {
    const isNumberInput = (el: EventTarget | null): el is HTMLInputElement =>
      el instanceof HTMLInputElement && el.type === "number";

    const onWheel = () => {
      if (isNumberInput(document.activeElement)) {
        (document.activeElement as HTMLInputElement).blur();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && isNumberInput(e.target)) {
        e.preventDefault();
      }
    };

    document.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
