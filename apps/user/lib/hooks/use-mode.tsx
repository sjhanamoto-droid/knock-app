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
import { useSession } from "next-auth/react";
import { validateSwitchMode } from "@/lib/actions/switch-mode";

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

interface ModeProviderProps {
  children: ReactNode;
  initialMode: Mode;
  initialCompanyType: string;
}

export function ModeProvider({ children, initialMode, initialCompanyType }: ModeProviderProps) {
  const { update } = useSession();
  const [activeMode, setActiveMode] = useState<Mode>(initialMode);
  const [companyType] = useState(initialCompanyType);

  const canSwitch = companyType === "BOTH";

  // data-mode 属性をルート要素に設定（CSS変数の切替用）
  useEffect(() => {
    document.documentElement.setAttribute("data-mode", activeMode);
    return () => {
      document.documentElement.removeAttribute("data-mode");
    };
  }, [activeMode]);

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
