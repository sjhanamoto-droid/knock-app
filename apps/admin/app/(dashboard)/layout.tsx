"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/", label: "ダッシュボード", icon: "dashboard" },
  { href: "/customers", label: "顧客管理", icon: "customers" },
  { href: "/sites", label: "現場管理", icon: "sites" },
  { href: "/settings", label: "設定", icon: "settings" },
];

function NavIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? "#E8960C" : "#9CA3AF";

  switch (type) {
    case "dashboard":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="3" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5" />
          <rect x="11" y="3" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5" />
          <rect x="3" y="11" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5" />
          <rect x="11" y="11" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5" />
        </svg>
      );
    case "customers":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="8" cy="6" r="3" stroke={color} strokeWidth="1.5" />
          <path d="M2 17C2 13.686 4.686 11 8 11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="14" cy="8" r="2.5" stroke={color} strokeWidth="1.5" />
          <path d="M18 17C18 14.239 16.209 12 14 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "sites":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="7" width="14" height="10" rx="1.5" stroke={color} strokeWidth="1.5" />
          <path d="M7 7V5C7 3.895 7.895 3 9 3H11C12.105 3 13 3.895 13 5V7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="2.5" stroke={color} strokeWidth="1.5" />
          <path d="M10 3V5M10 15V17M3 10H5M15 10H17M5.05 5.05L6.46 6.46M13.54 13.54L14.95 14.95M14.95 5.05L13.54 6.46M6.46 13.54L5.05 14.95" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-50 flex h-full w-60 flex-col border-r border-gray-100 bg-white shadow-[2px_0_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-knock-orange text-[16px] font-bold text-white">
            K
          </div>
          <span className="text-[17px] font-bold text-gray-900">Knock Admin</span>
        </div>

        <nav className="flex-1 px-3 py-2">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-knock-orange/8 text-knock-orange font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <NavIcon type={item.icon} active={isActive} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 px-3 py-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 17H4C3.45 17 3 16.55 3 16V4C3 3.45 3.45 3 4 3H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 14L17 10L13 6M17 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-60 flex-1 bg-[#F5F5F5] p-8">{children}</main>
    </div>
  );
}
