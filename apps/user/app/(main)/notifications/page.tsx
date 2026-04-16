"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/actions/notifications";
import { formatDateTime } from "@knock/utils";
import { PageHeader } from "@/components/page-header";

type Notification = Awaited<ReturnType<typeof getNotifications>>[number];

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications()
      .then(setNotifications)
      .finally(() => setLoading(false));
  }, []);

  async function handleMarkAll() {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, seenFlag: true })));
  }

  async function handleMarkRead(id: string) {
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, seenFlag: true } : n))
    );
  }

  const unreadCount = notifications.filter((n) => !n.seenFlag).length;

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <PageHeader
        title="大事なお知らせ"
        showBackButton
        onBack={() => router.back()}
        rightElement={
          unreadCount > 0 ? (
            <button
              onClick={handleMarkAll}
              className="text-[13px] font-semibold text-knock-blue whitespace-nowrap"
            >
              すべて既読
            </button>
          ) : (
            <div className="w-10" />
          )
        }
      />

      <div className="flex flex-col gap-3 px-4 pt-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M16 31C16 33.21 17.79 35 20 35C22.21 35 24 33.21 24 31M30 20C30 14.48 25.52 10 20 10C14.48 10 10 14.48 10 20V26L7 31H33L30 26V20Z" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-[13px] text-knock-text-muted">通知はありません</span>
          </div>
        ) : (
          notifications.map((notification) => {
            const href = notification.route;
            return (
              <button
                key={notification.id}
                onClick={async () => {
                  if (!notification.seenFlag) await handleMarkRead(notification.id);
                  if (href) router.push(href);
                }}
                className={`flex items-start gap-3 rounded-xl border-l-4 bg-white p-4 text-left shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98] ${
                  !notification.seenFlag ? "border-l-knock-blue" : "border-l-gray-200"
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {/* Title + Time */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-[15px] ${!notification.seenFlag ? "font-bold" : "font-semibold"} text-knock-text`}>
                      {notification.title}
                    </h3>
                    <span className="shrink-0 text-[11px] text-knock-text-muted whitespace-nowrap">
                      {formatDateTime(new Date(notification.createdAt))}
                    </span>
                  </div>

                  {/* Content */}
                  <p className="text-[13px] text-gray-500 line-clamp-3">
                    {notification.content}
                  </p>

                  {/* Company info */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="2" y="4" width="10" height="8" rx="1" stroke="#9CA3AF" strokeWidth="1" />
                        <path d="M5 4V2.5H9V4" stroke="#9CA3AF" strokeWidth="1" strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className="text-[12px] text-gray-500">
                      {notification.title?.includes("(株)") ? notification.title : "(株)職人インテリア"}
                    </span>
                  </div>
                </div>

                {/* Chevron */}
                <div className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-knock-blue mt-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3L9 7L5 11" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
