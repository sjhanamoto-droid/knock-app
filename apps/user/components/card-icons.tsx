/* カード（ホームの現場カード・現場一覧の工事カード）で共通のアイコン */
const ICON_COLOR = "#9CA3AF";

export function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 13 13" fill="none" className="shrink-0">
      <path
        d="M6.5 1C4.567 1 3 2.567 3 4.5C3 7.25 6.5 12 6.5 12C6.5 12 10 7.25 10 4.5C10 2.567 8.433 1 6.5 1Z"
        fill={ICON_COLOR}
      />
      <circle cx="6.5" cy="4.5" r="1.3" fill="white" />
    </svg>
  );
}

export function HammerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <path d="M6.2 2.2L8.6 1.4L12.2 5L10.6 6.6L9.2 5.2L3 11.4L1.6 10L7.8 3.8L6.2 2.2Z" fill="#4B5563" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 13 13" fill="none" className="shrink-0">
      <rect x="1.5" y="2.5" width="10" height="9" rx="1.2" stroke={ICON_COLOR} strokeWidth="1.2" />
      <path d="M1.5 5.5H11.5" stroke={ICON_COLOR} strokeWidth="1.2" />
      <path d="M4 1.5V3.5" stroke={ICON_COLOR} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 1.5V3.5" stroke={ICON_COLOR} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function BuildingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <path d="M2.5 12.5V2.5C2.5 1.95 2.95 1.5 3.5 1.5H8C8.55 1.5 9 1.95 9 2.5V12.5M9 5.5H10.5C11.05 5.5 11.5 5.95 11.5 6.5V12.5M1.5 12.5H12.5" stroke={ICON_COLOR} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 4H7M4.5 6.5H7M4.5 9H7" stroke={ICON_COLOR} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function YenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 13 13" fill="none" className="shrink-0">
      <path d="M3.5 2L6.5 6.5L9.5 2M6.5 6.5V11.5M4 7H9M4 9H9" stroke={ICON_COLOR} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
      <path d="M7 4L12 9L7 14" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
