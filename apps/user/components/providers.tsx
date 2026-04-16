"use client";

import { SessionProvider } from "next-auth/react";
import { ModeProvider } from "@/lib/hooks/use-mode";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ModeProvider>{children}</ModeProvider>
    </SessionProvider>
  );
}
