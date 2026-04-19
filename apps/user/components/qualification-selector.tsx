"use client";

import { useState } from "react";

type QualificationMaster = {
  id: string;
  name: string;
  category: string | null;
};

interface QualificationSelectorProps {
  masters: QualificationMaster[];
  value: string[]; // selected qualification IDs
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export default function QualificationSelector({
  masters,
  value,
  onChange,
  disabled,
}: QualificationSelectorProps) {
  const [search, setSearch] = useState("");

  const selectedIds = new Set(value);

  // Group by category
  const categories = new Map<string, QualificationMaster[]>();
  for (const m of masters) {
    const cat = m.category || "その他";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(m);
  }

  // Filter by search
  const lowerSearch = search.toLowerCase();
  const filteredCategories = new Map<string, QualificationMaster[]>();
  for (const [cat, items] of categories) {
    const filtered = search
      ? items.filter(
          (m) =>
            m.name.toLowerCase().includes(lowerSearch) ||
            cat.toLowerCase().includes(lowerSearch)
        )
      : items;
    if (filtered.length > 0) filteredCategories.set(cat, filtered);
  }

  function toggle(id: string) {
    if (disabled) return;
    if (selectedIds.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="資格を検索..."
          disabled={disabled}
          className="w-full rounded-xl bg-[#F0F0F0] py-2.5 pl-9 pr-4 text-[13px] focus:outline-none focus:ring-2 focus:ring-knock-orange/30"
        />
      </div>

      {/* Selected count */}
      {value.length > 0 && (
        <p className="text-[12px] text-knock-orange font-medium">
          {value.length}件選択中
        </p>
      )}

      {/* Category groups */}
      <div className="max-h-[300px] overflow-y-auto rounded-xl border border-gray-200 bg-white">
        {filteredCategories.size === 0 && (
          <p className="px-4 py-6 text-center text-[13px] text-gray-400">
            該当する資格がありません
          </p>
        )}
        {Array.from(filteredCategories).map(([cat, items], catIdx) => (
          <div key={cat}>
            {catIdx > 0 && <div className="border-t border-gray-100" />}
            <div className="sticky top-0 bg-gray-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {cat}
            </div>
            {items.map((m) => {
              const isChecked = selectedIds.has(m.id);
              return (
                <label
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-2 transition-colors active:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(m.id)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-gray-300 text-knock-orange accent-knock-orange"
                  />
                  <span className="text-[13px] text-knock-text">{m.name}</span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
