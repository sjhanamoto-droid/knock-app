"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@knock/ui";
import { NumberInputGuard } from "@/components/number-input-guard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NumberInputGuard />
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
