"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMembers } from "@/lib/actions/members";
import { userRoleLabels } from "@knock/utils";
import { useMode } from "@/lib/hooks/use-mode";

type Member = Awaited<ReturnType<typeof getMembers>>[number];

/* ──────────── Wavy Underline SVG ──────────── */

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function MembersPage() {
  const router = useRouter();
  const { accentColor } = useMode();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMembers()
      .then(setMembers)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="relative flex items-center justify-between px-4 py-3">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M13 4L7 10L13 16"
                stroke="#1A1A1A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Centered title */}
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
              Knockメンバー管理
            </h1>
            <WavyUnderline color={accentColor} />
          </div>

          {/* Add member button */}
          <Link
            href="/members/new"
            className="rounded-full bg-knock-orange px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-all active:scale-95"
          >
            + メンバー追加
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-2.5 px-4 pt-3 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white py-12 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="14" r="6" stroke="#D1D5DB" strokeWidth="1.8" />
              <path d="M8 34C8 28.477 13.373 24 20 24C26.627 24 32 28.477 32 34" stroke="#D1D5DB" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="text-[13px] text-knock-text-muted">メンバーがいません</span>
          </div>
        ) : (
          members.map((member) => (
            <Link
              key={member.id}
              href={`/members/${member.id}`}
              className="flex items-center gap-3.5 rounded-xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98]"
            >
              {/* Avatar circle */}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-knock-orange/10 text-[15px] font-bold text-knock-orange">
                {member.lastName?.charAt(0)}
              </div>

              {/* Name + email */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-semibold text-knock-text">
                  {member.lastName} {member.firstName}
                </span>
                <span className="truncate text-[12px] text-knock-text-secondary">
                  {member.email}
                </span>
                {/* Role badge */}
                <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                  {userRoleLabels[member.role] ?? member.role}
                </span>
                {!member.isActive && (
                  <span className="text-[10px] font-medium text-red-500">無効</span>
                )}
              </div>

              {/* Blue chevron circle button */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3B82F6]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M5 3L9 7L5 11"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
