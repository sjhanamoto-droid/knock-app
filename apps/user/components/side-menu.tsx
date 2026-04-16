"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useMode } from "@/lib/hooks/use-mode";

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  companyName?: string;
}

const menuItems = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/sites", label: "現場一覧", icon: "site" },
  { href: "/chat", label: "チャット", icon: "chat" },
  { href: "/orders", label: "発注一覧", icon: "order" },
  { href: "/members", label: "メンバー管理", icon: "member" },
  { href: "/templates", label: "テンプレート", icon: "template" },
  { href: "/notifications", label: "通知", icon: "bell" },
  { href: "/mypage", label: "マイページ", icon: "user" },
] as const;

function MenuItemIcon({ type }: { type: string }) {
  switch (type) {
    case "home":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 8.5L10 3L17 8.5V16C17 16.55 16.55 17 16 17H12.5V11.5H7.5V17H4C3.45 17 3 16.55 3 16V8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "site":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="7" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 7V5C7 3.895 7.895 3 9 3H11C12.105 3 13 3.895 13 5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "chat":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M17 10C17 13.314 13.866 16 10 16C8.82 16 7.71 15.765 6.725 15.34L3 16L4.07 13.06C3.394 12.03 3 10.854 3 10C3 6.686 6.134 4 10 4C13.866 4 17 6.686 17 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "order":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="4" y="3" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 7H13M7 10H13M7 13H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "member":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 17C4 14.239 6.686 12 10 12C13.314 12 16 14.239 16 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "template":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 7H14M6 10H14M6 13H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "bell":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M8 15C8 16.1 8.9 17 10 17C11.1 17 12 16.1 12 15M15 10C15 7.24 12.76 5 10 5C7.24 5 5 7.24 5 10V13L3.5 15H16.5L15 13V10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
      );
    case "user":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 17C4 14.239 6.686 12 10 12C13.314 12 16 14.239 16 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function SwitchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M5 7L9 3L13 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 11L9 15L5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SideMenu({ open, onClose, userName, companyName }: SideMenuProps) {
  const { mode, companyType, canSwitch, switchMode, accentColor, isOrderer } = useMode();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  const handleSwitchMode = async () => {
    const newMode = isOrderer ? "CONTRACTOR" : "ORDERER";
    setSwitching(true);
    try {
      await switchMode(newMode);
      onClose();
      router.push("/");
      router.refresh();
    } finally {
      setSwitching(false);
    }
  };

  const modeLabel = isOrderer ? "発注者モード" : "受注者モード";
  const otherModeLabel = isOrderer ? "受注者モード" : "発注者モード";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed left-0 top-0 z-[70] flex h-full w-[280px] flex-col bg-white shadow-xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="border-b border-gray-100 px-5 pb-4 pt-[env(safe-area-inset-top,12px)]">
          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-[15px] font-bold text-gray-900">{userName ?? "ユーザー"}</p>
              <p className="mt-0.5 text-[12px] text-gray-500">{companyName ?? ""}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L13 13M13 3L3 13" stroke="#666" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Mode Indicator */}
          <div className="mt-3 flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-bold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {modeLabel}
            </span>
          </div>
        </div>

        {/* Mode Switcher */}
        {canSwitch && (
          <div className="border-b border-gray-100 px-5 py-3">
            <button
              onClick={handleSwitchMode}
              disabled={switching}
              className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-4 py-3 transition-colors active:bg-gray-100 disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-gray-500">
                  <SwitchIcon />
                </span>
                <span className="text-[13px] font-medium text-gray-700">
                  {switching ? "切り替え中..." : `${otherModeLabel}に切り替え`}
                </span>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="#C0C0C0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Create Other Type Account (single-type only) */}
        {!canSwitch && companyType && companyType !== "BOTH" && (
          <div className="border-b border-gray-100 px-5 py-3">
            <Link
              href="/add-type"
              onClick={onClose}
              className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-4 py-3 transition-colors active:bg-gray-100"
            >
              <div className="flex items-center gap-2.5">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="7" stroke="#6B6B6B" strokeWidth="1.4" />
                  <path d="M9 6V12M6 9H12" stroke="#6B6B6B" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <span className="text-[13px] font-medium text-gray-700">
                  {companyType === "CONTRACTOR" ? "発注者アカウントを作成" : "受注者アカウントを作成"}
                </span>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3L11 8L6 13" stroke="#C0C0C0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        )}

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3.5 rounded-xl px-3 py-3 text-gray-700 transition-colors active:bg-gray-100"
            >
              <span className="text-gray-500">
                <MenuItemIcon type={item.icon} />
              </span>
              <span className="text-[14px] font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 px-3 py-3 pb-[env(safe-area-inset-bottom,12px)]">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-red-600 transition-colors active:bg-red-50"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 17H4C3.45 17 3 16.55 3 16V4C3 3.45 3.45 3 4 3H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 14L17 10L13 6M17 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[14px] font-medium">ログアウト</span>
          </button>
        </div>
      </div>
    </>
  );
}
