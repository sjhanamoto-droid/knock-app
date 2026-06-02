"use client";

import { useRouter } from "next/navigation";
import { formatDateTime } from "@knock/utils";
import { PageHeader } from "@/components/page-header";

interface Props {
  notification: {
    id: string;
    title: string;
    content: string;
    type: number;
    createdAt: string;
  };
}

export function NotificationDetailClient({ notification }: Props) {
  const router = useRouter();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F5F5F5]">
      <PageHeader
        title="お知らせ"
        showBackButton
        onBack={() => router.push("/notifications")}
        rightElement={<div className="w-10" />}
      />

      <div className="flex flex-col px-4 pt-4 pb-8">
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <span className="text-[12px] font-bold text-knock-blue">運営からのお知らせ</span>
          <h1 className="mt-1.5 text-[18px] font-bold leading-snug text-knock-text">
            {notification.title}
          </h1>
          <p className="mt-1 text-[12px] text-knock-text-muted">
            {formatDateTime(new Date(notification.createdAt))}
          </p>
          <div className="my-4 border-t border-gray-100" />
          <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-knock-text">
            {notification.content}
          </p>
        </div>
      </div>
    </div>
  );
}
