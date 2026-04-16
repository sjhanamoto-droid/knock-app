"use client";

interface Tab {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  variant?: "underline" | "pill";
}

export function Tabs({ tabs, value, onChange, variant = "underline" }: TabsProps) {
  if (variant === "pill") {
    return (
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
              value === tab.value
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-[11px] opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`relative px-4 py-2.5 text-[13px] font-semibold transition-colors ${
            value === tab.value
              ? "text-gray-900"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1 text-[11px] opacity-60">({tab.count})</span>
          )}
          {value === tab.value && (
            <span className="absolute bottom-0 left-0 h-[2px] w-full bg-gray-900" />
          )}
        </button>
      ))}
    </div>
  );
}
