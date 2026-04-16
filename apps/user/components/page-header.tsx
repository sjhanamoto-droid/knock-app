"use client";

import Link from "next/link";

interface PageHeaderProps {
  title: string;
  onMenuOpen?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  badgeCount?: number;
  rightElement?: React.ReactNode;
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 7H20M4 12H20M4 17H20" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M18 8C18 4.686 15.314 2 12 2C8.686 2 6 4.686 6 8V13L4 16H20L18 13V8Z" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 19C10 20.105 10.895 21 12 21C13.105 21 14 20.105 14 19" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M15 19L8 12L15 5" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PageHeader({
  title,
  onMenuOpen,
  showBackButton,
  onBack,
  badgeCount = 0,
  rightElement,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Menu or Back button */}
        {showBackButton ? (
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <BackIcon />
          </button>
        ) : onMenuOpen ? (
          <button
            onClick={onMenuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <MenuIcon />
          </button>
        ) : (
          <div className="w-10" />
        )}

        {/* Center: Title with orange underline */}
        <div className="flex flex-col items-center">
          <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
            {title}
          </h1>
          <svg width="40" height="4" viewBox="0 0 40 4" className="mt-0.5">
            <path
              d="M2 2C8 0.5 12 3.5 20 2C28 0.5 32 3.5 38 2"
              stroke="#E8960C"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>

        {/* Right: Bell or custom element */}
        {rightElement ?? (
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <BellIcon />
            {badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-knock-red text-[10px] font-bold text-white">
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  );
}
