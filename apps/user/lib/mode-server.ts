import { cache } from "react";
import { auth } from "@/auth";

export type Mode = "ORDERER" | "CONTRACTOR";

export interface ModeData {
  mode: Mode;
  companyType: string;
  canSwitch: boolean;
  isContractor: boolean;
  isOrderer: boolean;
  accentColor: string;
  accentColorLight: string;
}

const getAuth = cache(() => auth());

export async function getServerMode(): Promise<ModeData> {
  const session = await getAuth();
  const s = session as unknown as Record<string, unknown>;
  const companyType = (s?.companyType as string) ?? "";
  const activeMode = ((s?.activeMode as string) || companyType || "CONTRACTOR") as Mode;
  const isOrderer = activeMode === "ORDERER";

  return {
    mode: activeMode,
    companyType,
    canSwitch: companyType === "BOTH",
    isContractor: !isOrderer,
    isOrderer,
    accentColor: isOrderer ? "#3B82F6" : "#E8960C",
    accentColorLight: isOrderer ? "#60A5FA" : "#F5B84D",
  };
}
