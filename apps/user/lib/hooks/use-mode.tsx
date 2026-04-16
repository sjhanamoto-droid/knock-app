"use client";

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useSession, signOut } from "next-auth/react";
import { validateSwitchMode } from "@/lib/actions/switch-mode";
import { getSessionMode } from "@/lib/actions/mode";

type Mode = "ORDERER" | "CONTRACTOR";

interface ModeContextValue {
  /** 現在のモード (ORDERER | CONTRACTOR) */
  mode: Mode;
  /** 会社タイプ (ORDERER | CONTRACTOR | BOTH) */
  companyType: string;
  /** BOTH の場合のみ true */
  canSwitch: boolean;
  /** モード切り替え */
  switchMode: (newMode: Mode) => Promise<void>;
  /** 受注者モードか */
  isContractor: boolean;
  /** 発注者モードか */
  isOrderer: boolean;
  /** テーマのアクセントカラー */
  accentColor: string;
  /** テーマのアクセントカラー（light） */
  accentColorLight: string;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const { status, update } = useSession();
  const [companyType, setCompanyType] = useState("");
  const [activeMode, setActiveMode] = useState<Mode>("CONTRACTOR");

  // サーバーアクションからモード情報を取得（確実にカスタムフィールドが取れる）
  useEffect(() => {
    if (status !== "authenticated") return;
    getSessionMode()
      .then((data) => {
        if (data) {
          setCompanyType(data.companyType);
          setActiveMode((data.activeMode as Mode) || "CONTRACTOR");
        } else {
          // セッションはあるがサーバー側で無効（古いセッション等）→ サインアウト
          signOut({ callbackUrl: "/login" });
        }
      })
      .catch(() => {
        // サーバーアクションエラー → セッション無効の可能性 → サインアウト
        signOut({ callbackUrl: "/login" });
      });
  }, [status]);

  const canSwitch = companyType === "BOTH";

  const switchMode = useCallback(
    async (newMode: Mode) => {
      if (!canSwitch) return;
      const result = await validateSwitchMode(newMode);
      if (result.success) {
        // JWTトークンを更新
        await update({ activeMode: newMode });
        // ローカルステートも即座に更新
        setActiveMode(newMode);
      }
    },
    [canSwitch, update]
  );

  const value = useMemo<ModeContextValue>(
    () => ({
      mode: activeMode,
      companyType,
      canSwitch,
      switchMode,
      isContractor: activeMode === "CONTRACTOR",
      isOrderer: activeMode === "ORDERER",
      accentColor: activeMode === "ORDERER" ? "#3B82F6" : "#E8960C",
      accentColorLight: activeMode === "ORDERER" ? "#60A5FA" : "#F5B84D",
    }),
    [activeMode, companyType, canSwitch, switchMode]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    // fallback for pages outside ModeProvider (auth pages etc.)
    return {
      mode: "CONTRACTOR",
      companyType: "",
      canSwitch: false,
      switchMode: async () => {},
      isContractor: true,
      isOrderer: false,
      accentColor: "#E8960C",
      accentColorLight: "#F5B84D",
    };
  }
  return ctx;
}
