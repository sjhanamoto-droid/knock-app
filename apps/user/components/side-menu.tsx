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

type MenuSection = {
  label: string;
  items: { href: string; label: string; icon: string }[];
};

const MENU_SECTIONS: MenuSection[] = [
  {
    label: "帳票",
    items: [
      { href: "/documents?type=ORDER_SHEET", label: "注文書", icon: "order" },
      { href: "/documents?type=DELIVERY_NOTE", label: "納品書", icon: "delivery" },
      { href: "/documents?type=INVOICE", label: "請求書", icon: "invoice" },
    ],
  },
  {
    label: "設定",
    items: [
      { href: "/mypage/plan", label: "契約情報", icon: "plan" },
    ],
  },
  {
    label: "利用方法",
    items: [
      { href: "/manual", label: "マニュアル", icon: "manual" },
      { href: "/contact", label: "問い合わせ", icon: "contact" },
    ],
  },
  {
    label: "その他",
    items: [
      { href: "/terms", label: "利用規約", icon: "terms" },
      { href: "/privacy", label: "プライバシーポリシー", icon: "privacy" },
      { href: "/legal", label: "特定商取引に基づく表記", icon: "legal" },
    ],
  },
];

function MenuItemIcon({ type }: { type: string }) {
  switch (type) {
    case "order":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="4" y="3" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 7H13M7 10H13M7 13H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "delivery":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="4" y="3" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 10L9 12L13 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "invoice":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="4" y="3" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 7H10M7 10H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M10 13L12 15L16 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "plan":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 9H17" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 12H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "manual":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 4C3 3.45 3.45 3 4 3H8C9.1 3 10 3.9 10 5V17C10 16.45 9.55 16 9 16H4C3.45 16 3 15.55 3 15V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M17 4C17 3.45 16.55 3 16 3H12C10.9 3 10 3.9 10 5V17C10 16.45 10.45 16 11 16H16C16.55 16 17 15.55 17 15V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "contact":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 7L10 11L17 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "terms":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3L16 6V10C16 13.5 13.5 16.5 10 17.5C6.5 16.5 4 13.5 4 10V6L10 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7.5 10L9 11.5L12.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "privacy":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="6" y="9" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7.5 9V7C7.5 5.067 9.067 3.5 10 3.5C10.933 3.5 12.5 5.067 12.5 7V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="12.5" r="1" fill="currentColor" />
        </svg>
      );
    case "legal":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M4 7L10 4L16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 7C4 7 3 10 4 11C5 12 7 12 7 11C7 10 6 7 6 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M14 7C14 7 13 10 14 11C15 12 17 12 17 11C17 10 16 7 16 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M7 17H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

        {/* Menu Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {MENU_SECTIONS.map((section, si) => (
            <div key={section.label}>
              {/* Section label */}
              <p className="mt-3 mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {section.label}
              </p>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-gray-700 transition-colors active:bg-gray-100"
                >
                  <span className="text-gray-500">
                    <MenuItemIcon type={item.icon} />
                  </span>
                  <span className="text-[14px] font-medium">{item.label}</span>
                </Link>
              ))}
              {/* Divider between sections */}
              {si < MENU_SECTIONS.length - 1 && (
                <div className="mx-3 my-2 border-t border-gray-100" />
              )}
            </div>
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
