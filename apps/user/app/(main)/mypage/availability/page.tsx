"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import {
  getAvailabilitySlots,
  updateAvailabilitySlots,
  getAvailabilitySettings,
  updateAvailabilityPublic,
} from "@/lib/actions/availability";

type SlotStatus = "AVAILABLE" | "BUSY" | "NEGOTIABLE";

const statusConfig: Record<SlotStatus, { label: string; color: string; bg: string }> = {
  AVAILABLE: { label: "空き", color: "#22C55E", bg: "#DCFCE7" },
  BUSY: { label: "予定あり", color: "#EF4444", bg: "#FEE2E2" },
  NEGOTIABLE: { label: "応相談", color: "#F59E0B", bg: "#FEF3C7" },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="80" height="6" viewBox="0 0 80 6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 3 Q5 0 10 3 Q15 6 20 3 Q25 0 30 3 Q35 6 40 3 Q45 0 50 3 Q55 6 60 3 Q65 0 70 3 Q75 6 80 3"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AvailabilityPage() {
  const router = useRouter();
  const { accentColor } = useMode();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [slots, setSlots] = useState<Record<string, SlotStatus>>({});
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTool, setSelectedTool] = useState<SlotStatus>("AVAILABLE");

  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [slotsData, settings] = await Promise.all([
        getAvailabilitySlots(yearMonth),
        getAvailabilitySettings(),
      ]);
      const map: Record<string, SlotStatus> = {};
      for (const s of slotsData) {
        const d = new Date(s.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        map[key] = s.status as SlotStatus;
      }
      setSlots(map);
      setIsPublic(settings.isPublic);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleDayClick(day: number) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSlots((prev) => {
      const next = { ...prev };
      if (next[key] === selectedTool) {
        delete next[key];
      } else {
        next[key] = selectedTool;
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const entries = Object.entries(slots).map(([date, status]) => ({
        date,
        status,
      }));
      await updateAvailabilitySlots(entries);
      alert("保存しました");
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    await updateAvailabilityPublic(next);
  }

  function goMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="flex flex-col bg-[#F5F5F5] min-h-screen">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">空き日カレンダー</h1>
            <WavyUnderline color={accentColor} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-3 pb-8">
        {/* 公開設定 */}
        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div>
            <p className="text-[14px] font-bold text-knock-text">カレンダーを公開</p>
            <p className="text-[12px] text-knock-text-secondary">発注者が空き日を確認できます</p>
          </div>
          <button
            onClick={handleTogglePublic}
            className={`relative h-7 w-12 rounded-full transition-colors ${isPublic ? "" : "bg-gray-300"}`}
            style={isPublic ? { backgroundColor: accentColor } : undefined}
          >
            <div
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>

        {/* 月ナビゲーション */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => goMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors active:bg-gray-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[16px] font-bold text-knock-text">
            {year}年{month}月
          </span>
          <button
            onClick={() => goMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors active:bg-gray-100"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3L11 8L6 13" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* ツール選択 */}
        <div className="flex gap-2">
          {(Object.keys(statusConfig) as SlotStatus[]).map((s) => {
            const cfg = statusConfig[s];
            const active = selectedTool === s;
            return (
              <button
                key={s}
                onClick={() => setSelectedTool(s)}
                className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-all ${active ? "ring-2" : "opacity-60"}`}
                style={{
                  backgroundColor: cfg.bg,
                  color: cfg.color,
                  ...(active ? { "--tw-ring-color": cfg.color } as React.CSSProperties : {}),
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* カレンダー */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-3 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <div className="grid grid-cols-7 gap-1">
              {dayLabels.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-[12px] font-bold py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-knock-text-secondary"}`}
                >
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const status = slots[key];
                const cfg = status ? statusConfig[status] : null;
                const dayOfWeek = (firstDay + i) % 7;
                const isToday = key === todayKey;

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className="flex flex-col h-11 w-11 mx-auto items-center justify-center gap-0.5 rounded-full text-[13px] font-medium transition-all active:scale-95"
                    style={cfg ? { backgroundColor: cfg.bg, color: cfg.color } : undefined}
                  >
                    <span className={!cfg ? (dayOfWeek === 0 ? "text-red-400" : dayOfWeek === 6 ? "text-blue-400" : "text-knock-text") : ""}>
                      {day}
                    </span>
                    {isToday && (
                      <span
                        className="h-1 w-1 rounded-full"
                        style={{ backgroundColor: cfg ? cfg.color : accentColor }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 凡例 */}
        <div className="flex justify-center gap-4">
          {(Object.keys(statusConfig) as SlotStatus[]).map((s) => {
            const cfg = statusConfig[s];
            return (
              <div key={s} className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className="text-[11px] text-knock-text-secondary">{cfg.label}</span>
              </div>
            );
          })}
        </div>

        {/* 保存 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </div>
  );
}
