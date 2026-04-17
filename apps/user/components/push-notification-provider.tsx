"use client";

import { useEffect, useState, useCallback } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationProvider() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;
    if (!VAPID_PUBLIC_KEY) return;

    if (Notification.permission === "granted") {
      registerSubscription();
    } else if (Notification.permission === "default") {
      setShowBanner(true);
    }
  }, []);

  const registerSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });
    } catch {
      // Silently fail
    }
  }, []);

  const handleEnable = useCallback(async () => {
    setShowBanner(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await registerSubscription();
      }
    } catch {
      // Silently fail
    }
  }, [registerSubscription]);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] mx-auto max-w-[430px]">
      <div className="mx-3 mt-2 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg border border-gray-100">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 2C7.24 2 5 4.24 5 7V10.5L3.5 13H16.5L15 10.5V7C15 4.24 12.76 2 10 2Z"
              fill="#2563EB"
            />
            <path d="M8 14C8 15.1 8.9 16 10 16C11.1 16 12 15.1 12 14" fill="#2563EB" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-900">
            通知を有効にしますか？
          </p>
          <p className="text-[11px] text-gray-500">
            発注・受注の更新をお知らせします
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setShowBanner(false)}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-gray-500"
          >
            後で
          </button>
          <button
            onClick={handleEnable}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-[12px] font-bold text-white"
          >
            有効にする
          </button>
        </div>
      </div>
    </div>
  );
}
