"use client";

import { useState } from "react";

type MajorItem = {
  id: string;
  name: string;
  subItems: { id: string; name: string }[];
};

type Selection = {
  occupationSubItemId: string;
  note?: string;
};

interface OccupationSelectorProps {
  masters: MajorItem[];
  value: Selection[];
  onChange: (selections: Selection[]) => void;
  disabled?: boolean;
}

export default function OccupationSelector({
  masters,
  value,
  onChange,
  disabled,
}: OccupationSelectorProps) {
  const [expandedMajor, setExpandedMajor] = useState<string | null>(null);

  const selectedIds = new Set(value.map((v) => v.occupationSubItemId));

  function toggleMajor(majorId: string) {
    setExpandedMajor(expandedMajor === majorId ? null : majorId);
  }

  function toggleSub(subId: string) {
    if (disabled) return;
    if (selectedIds.has(subId)) {
      onChange(value.filter((v) => v.occupationSubItemId !== subId));
    } else {
      onChange([...value, { occupationSubItemId: subId }]);
    }
  }

  function setNote(subId: string, note: string) {
    onChange(
      value.map((v) =>
        v.occupationSubItemId === subId ? { ...v, note: note || undefined } : v
      )
    );
  }

  function getNote(subId: string): string {
    return value.find((v) => v.occupationSubItemId === subId)?.note ?? "";
  }

  // Count selected subs per major
  function selectedCount(major: MajorItem): number {
    return major.subItems.filter((s) => selectedIds.has(s.id)).length;
  }

  return (
    <div className="flex flex-col gap-2">
      {masters.map((major) => {
        const isExpanded = expandedMajor === major.id;
        const count = selectedCount(major);

        return (
          <div
            key={major.id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            {/* Major item header */}
            <button
              type="button"
              onClick={() => toggleMajor(major.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors active:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-knock-text">
                  {major.name}
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-knock-orange/10 px-2 py-0.5 text-[11px] font-bold text-knock-orange">
                    {count}
                  </span>
                )}
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="#999"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Sub items */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 py-2">
                {major.subItems.map((sub) => {
                  const isChecked = selectedIds.has(sub.id);
                  return (
                    <div key={sub.id} className="py-1.5">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSub(sub.id)}
                          disabled={disabled}
                          className="h-4 w-4 rounded border-gray-300 text-knock-orange accent-knock-orange"
                        />
                        <span className="text-[13px] text-knock-text">
                          {sub.name}
                        </span>
                      </label>
                      {isChecked && (
                        <input
                          type="text"
                          value={getNote(sub.id)}
                          onChange={(e) => setNote(sub.id, e.target.value)}
                          disabled={disabled}
                          placeholder="詳細を入力（任意）"
                          className="mt-1.5 ml-7 w-[calc(100%-28px)] rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] text-gray-700 placeholder:text-gray-400 focus:border-knock-blue focus:outline-none focus:ring-1 focus:ring-knock-blue"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
