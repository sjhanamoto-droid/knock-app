"use client";

import { ModeProvider } from "@/lib/hooks/use-mode";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ModeProvider>{children}</ModeProvider>;
}
