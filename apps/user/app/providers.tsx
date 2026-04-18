"use client";

import { ToastProvider } from "@knock/ui";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
