"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Providers } from "@/components/providers";
import { PushNotificationProvider } from "@/components/push-notification-provider";
import { getHomeBadgeCounts } from "@/lib/actions/home";
import { useMode } from "@/lib/hooks/use-mode";

/* ──────────── Icon Components ──────────── */

function HomeIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H15V14H9V21H4C3.45 21 3 20.55 3 20V10.5Z"
        fill={active ? color : "none"}
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SiteIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 3L2 9V21H9V14H15V21H22V9L12 3Z"
        fill={active ? color : "none"}
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 21V14H15V21"
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3V7"
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="11"
        cy="11"
        r="7"
        fill={active ? color : "none"}
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
      />
      <path
        d="M16.5 16.5L21 21"
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {active && (
        <>
          <line x1="8" y1="11" x2="14" y2="11" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="11" y1="8" x2="11" y2="14" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function ChatIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M21 12C21 16.418 16.97 20 12 20C10.55 20 9.178 19.707 7.95 19.178L3 20L4.338 16.322C3.492 15.032 3 13.568 3 12C3 7.582 7.03 4 12 4C16.97 4 21 7.582 21 12Z"
        fill={active ? color : "none"}
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="12" r="1" fill={active ? "white" : "#8E8E93"} />
      <circle cx="12" cy="12" r="1" fill={active ? "white" : "#8E8E93"} />
      <circle cx="15.5" cy="12" r="1" fill={active ? "white" : "#8E8E93"} />
    </svg>
  );
}

function MyPageIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="12"
        cy="8"
        r="4"
        fill={active ? color : "none"}
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
      />
      <path
        d="M4 21C4 17.134 7.582 14 12 14C16.418 14 20 17.134 20 21"
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DocumentIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14 2H6C5.45 2 5 2.45 5 3V21C5 21.55 5.45 22 6 22H18C18.55 22 19 21.55 19 21V7L14 2Z"
        fill={active ? color : "none"}
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2V7H19"
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {active ? (
        <>
          <line x1="9" y1="12" x2="15" y2="12" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="9" y1="15" x2="13" y2="15" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="9" y1="18" x2="11" y2="18" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="9" y1="12" x2="15" y2="12" stroke="#8E8E93" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="9" y1="15" x2="13" y2="15" stroke="#8E8E93" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="9" y1="18" x2="11" y2="18" stroke="#8E8E93" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function JobIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="3"
        y="7"
        width="18"
        height="14"
        rx="1"
        fill={active ? color : "none"}
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 7V5C8 3.9 8.9 3 10 3H14C15.1 3 16 3.9 16 5V7"
        stroke={active ? color : "#8E8E93"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {active && (
        <path
          d="M12 11V17M9 14H15"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/* ──────────── Nav Item Types ──────────── */

type IconComponent = (props: { active: boolean; color: string }) => React.ReactNode;

interface NavItem {
  href: string;
  label: string;
  icon: IconComponent;
  badge: boolean;
}

/* 受注者ナビ（V2: 5タブ） */
const contractorNav: NavItem[] = [
  { href: "/", label: "ホーム", icon: HomeIcon, badge: false },
  { href: "/sites", label: "現場", icon: SiteIcon, badge: false },
  { href: "/jobs", label: "案件", icon: JobIcon, badge: false },
  { href: "/chat", label: "チャット", icon: ChatIcon, badge: false },
  { href: "/mypage", label: "マイページ", icon: MyPageIcon, badge: false },
];

/* 発注者ナビ（V2: 5タブ） */
const ordererNav: NavItem[] = [
  { href: "/", label: "ホーム", icon: HomeIcon, badge: false },
  { href: "/sites", label: "現場", icon: SiteIcon, badge: false },
  { href: "/search", label: "探す", icon: SearchIcon, badge: false },
  { href: "/chat", label: "チャット", icon: ChatIcon, badge: false },
  { href: "/mypage", label: "マイページ", icon: MyPageIcon, badge: false },
];

/* ──────────── Inner Layout (uses useMode) ──────────── */

function MainLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode, accentColor, isOrderer } = useMode();
  const [chatBadge, setChatBadge] = useState(false);

  const navItems = isOrderer ? ordererNav : contractorNav;

  // data-mode 属性をルート要素に設定（CSS変数の切替用）
  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
    return () => {
      document.documentElement.removeAttribute("data-mode");
    };
  }, [mode]);

  // チャット未読バッジ取得
  useEffect(() => {
    getHomeBadgeCounts()
      .then((b) => setChatBadge(b.chats > 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[430px] flex-col bg-knock-bg">
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-knock-border bg-white/95 backdrop-blur-md">
        <div className="flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center gap-0.5 px-3 py-2.5"
              >
                <div className="relative">
                  <Icon active={isActive} color={accentColor} />
                  {(item.badge || (item.href === "/chat" && chatBadge)) && (
                    <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-knock-red ring-2 ring-white" />
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold tracking-wide"
                  style={{ color: isActive ? accentColor : "#8E8E93" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* ──────────── Outer Layout (wraps with Providers) ──────────── */

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <PushNotificationProvider />
      <MainLayoutInner>{children}</MainLayoutInner>
    </Providers>
  );
}
