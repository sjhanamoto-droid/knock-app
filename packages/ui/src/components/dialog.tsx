"use client";

import { type ReactNode, useEffect, useCallback } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function Dialog({ open, onClose, children, title }: DialogProps) {
  // Escapeキーで閉じる
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // スクロール防止
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="mx-4 w-full max-w-[28rem] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        style={{ maxHeight: "calc(100dvh - 2rem)" }}
      >
        {title && (
          <h2 className="mb-4 text-[16px] font-bold text-gray-900">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}

interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonLabel?: string;
}

export function AlertDialog({
  open,
  onClose,
  title,
  message,
  buttonLabel = "閉じる",
}: AlertDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="mb-5 text-[14px] text-gray-600">{message}</p>
      <button
        onClick={onClose}
        className="w-full rounded-xl px-4 py-3.5 text-[15px] font-bold text-white shadow-sm transition-opacity active:opacity-80"
        style={{ backgroundColor: "#2563EB" }}
      >
        {buttonLabel}
      </button>
    </Dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "確認",
  cancelLabel = "キャンセル",
  variant = "primary",
}: ConfirmDialogProps) {
  const confirmBg = variant === "danger" ? "#DC2626" : "#2563EB";

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="mb-5 text-[14px] text-gray-600">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={async () => {
            await Promise.resolve(onConfirm());
            onClose();
          }}
          className="flex-1 rounded-lg px-4 py-2.5 text-[14px] font-medium text-white transition-opacity active:opacity-80"
          style={{ backgroundColor: confirmBg }}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
