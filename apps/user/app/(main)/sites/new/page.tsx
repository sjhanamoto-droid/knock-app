"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSite } from "@/lib/actions/sites";
import { getUnits } from "@/lib/actions/sites";
import { getOccupationMasters } from "@/lib/actions/occupations";
import { useToast } from "@knock/ui";
import SiteForm from "@/components/sites/site-form";
import { useMode } from "@/lib/hooks/use-mode";

type MajorItem = {
  id: string;
  name: string;
  subItems: { id: string; name: string }[];
};
type UnitOption = { id: string; name: string };

export default function NewSitePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { accentColor } = useMode();
  const [occupationMasters, setOccupationMasters] = useState<MajorItem[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getOccupationMasters(), getUnits()])
      .then(([masters, unitData]) => {
        setOccupationMasters(masters);
        setUnits(unitData);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(data: Parameters<typeof createSite>[0]) {
    await createSite(data);
    toast("現場を作成しました");
    router.push("/sites");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push("/sites")}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M13 4L7 10L13 16"
                stroke="#1A1A1A"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
              現場を作成
            </h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path
                d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4"
                stroke={accentColor}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="bg-[#F5F5F5] pt-3">
        <SiteForm
          mode="create"
          onSubmit={handleCreate}
          occupationMasters={occupationMasters}
          units={units}
        />
      </div>
    </div>
  );
}
