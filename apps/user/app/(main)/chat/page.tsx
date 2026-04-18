"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { SideMenu } from "@/components/side-menu";
import { getChatRooms } from "@/lib/actions/chat";
import { formatDateTime } from "@knock/utils";
import { useMode } from "@/lib/hooks/use-mode";

type ChatRoomsResult = Awaited<ReturnType<typeof getChatRooms>>;
type ChatRoom = ChatRoomsResult["rooms"][number];

type ViewMode = "select" | "NEGOTIATION" | "SITE_INFO";

// ─── Icons ──────────────────────────────────────────────

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M3 6H19M3 11H19M3 16H19"
        stroke="#1A1A1A"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M11 2C7.686 2 5 4.686 5 8V12L3 15H19L17 12V8C17 4.686 14.314 2 11 2Z"
        stroke="#1A1A1A"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 18C9 19.105 9.895 20 11 20C12.105 20 13 19.105 13 18"
        stroke="#1A1A1A"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M14 5L7 11L14 17"
        stroke="#1A1A1A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.4" />
      <path d="M11 11L14 14" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Handshake illustration (交渉ルーム) ────────────────

function HandshakeIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <path
        d="M8 36L20 24L26 28L34 20L42 26L54 14"
        stroke="#60A5FA"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 44L26 36M28 46L38 36"
        stroke="#93C5FD"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M22 40C22 40 28 34 32 34C36 34 42 40 42 40L36 46C36 46 34 48 32 48C30 48 28 46 28 46L22 40Z"
        stroke="#3B82F6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#DBEAFE"
      />
      <path
        d="M32 34V28M28 30L32 26L36 30"
        stroke="#60A5FA"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Map/Location illustration (現場情報ルーム) ─────────

function MapIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <rect
        x="10"
        y="18"
        width="44"
        height="32"
        rx="4"
        fill="#FEF3C7"
        stroke="#FCD34D"
        strokeWidth="1.5"
      />
      <path
        d="M22 18V50M42 18V50"
        stroke="#FCD34D"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 30H54M10 38H54"
        stroke="#FCD34D"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="34" r="6" fill="#F59E0B" opacity="0.3" />
      <circle cx="32" cy="34" r="3" fill="#D97706" />
      <path
        d="M32 20C28.686 20 26 22.686 26 26C26 30.5 32 37 32 37C32 37 38 30.5 38 26C38 22.686 35.314 20 32 20Z"
        fill="#F59E0B"
        stroke="#D97706"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="26" r="2.5" fill="white" />
    </svg>
  );
}

// ─── Room Row (list view) ────────────────────────────────

function RoomRow({ room, myCompanyId }: { room: ChatRoom; myCompanyId: string }) {
  const isNegotiation = room.type === "NEGOTIATION";
  const partner =
    room.orderCompany.id === myCompanyId ? room.workerCompany : room.orderCompany;

  const lastMsg = room.lastMessage;
  const preview =
    lastMsg?.type === "FILE"
      ? "ファイルを送信しました"
      : (lastMsg?.message ?? "メッセージなし");

  return (
    <Link
      href={`/chat/${room.id}`}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-gray-50 border-b border-gray-100 last:border-b-0"
    >
      {/* Avatar */}
      {partner.logo ? (
        <img
          src={partner.logo}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${
            isNegotiation
              ? "bg-blue-50 text-blue-400"
              : "bg-amber-50 text-amber-400"
          }`}
        >
          {partner.name?.charAt(0) ?? "?"}
        </div>
      )}

      {/* Text */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[14px] font-semibold text-knock-text">
            {partner.name ?? "不明"}
          </span>
          {lastMsg && (
            <span className="shrink-0 text-[11px] text-knock-text-muted">
              {formatDateTime(new Date(lastMsg.createdAt))}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          {isNegotiation ? null : (
            <span className="shrink-0 text-[11px] text-amber-600 font-medium bg-amber-50 rounded px-1.5 py-0.5">
              {room.factoryFloor?.name ?? "現場"}
            </span>
          )}
          <span className="truncate text-[12px] text-knock-text-secondary flex-1">
            {preview}
          </span>
          {room.unreadCount > 0 && (
            <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-knock-red px-1 text-[10px] font-bold text-white">
              {room.unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-gray-300">
        <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

// ─── Room List View ──────────────────────────────────────

function RoomListView({
  type,
  rooms,
  myCompanyId,
  onBack,
  accentColor,
}: {
  type: "NEGOTIATION" | "SITE_INFO";
  rooms: ChatRoom[];
  myCompanyId: string;
  onBack: () => void;
  accentColor: string;
}) {
  const [query, setQuery] = useState("");

  const isNegotiation = type === "NEGOTIATION";
  const title = isNegotiation ? "交渉ルーム" : "現場情報ルーム";
  const headerBg = isNegotiation ? "bg-blue-50" : "bg-amber-50";
  const headerAccent = isNegotiation ? "#3B82F6" : "#D97706";

  const filtered = useMemo(() => {
    if (!query.trim()) return rooms;
    const q = query.toLowerCase();
    return rooms.filter((r) => {
      const partner =
        r.orderCompany.id === myCompanyId ? r.workerCompany : r.orderCompany;
      if (partner.name?.toLowerCase().includes(q)) return true;
      if (r.factoryFloor?.name?.toLowerCase().includes(q)) return true;
      if (r.lastMessage?.message?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [rooms, query, myCompanyId]);

  const totalUnread = rooms.reduce((s, r) => s + r.unreadCount, 0);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50">
      {/* Header */}
      <header className={`sticky top-0 z-40 ${headerBg}`}>
        <div className="flex items-center gap-3 px-3 py-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-black/5"
          >
            <BackIcon />
          </button>

          <div className="flex flex-1 flex-col">
            <h1 className="text-[17px] font-bold text-knock-text">{title}</h1>
            <p className="text-[12px]" style={{ color: headerAccent }}>
              {rooms.length} 件
              {totalUnread > 0 && ` · 未読 ${totalUnread}`}
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <SearchIcon />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="会社名・現場名で検索"
              className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder:text-gray-400 outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-gray-400">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* List */}
      <div className="flex-1 px-4 pt-4 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="#E5E7EB" strokeWidth="2" />
              <path d="M16 24h16M24 16v16" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="text-[14px] text-gray-400">
              {query ? "検索結果がありません" : "チャットルームがありません"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
            {filtered.map((room) => (
              <RoomRow key={room.id} room={room} myCompanyId={myCompanyId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Site Info: Parent List View ─────────────────────────

type ParentGroup = {
  parentId: string;
  parentName: string;
  rooms: ChatRoom[];
  latestTime: Date | null;
  totalUnread: number;
};

function SiteParentListView({
  rooms,
  myCompanyId,
  onBack,
  onSelectParent,
}: {
  rooms: ChatRoom[];
  myCompanyId: string;
  onBack: () => void;
  onSelectParent: (parentId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, ParentGroup>();
    for (const room of rooms) {
      const parentId = room.factoryFloor?.parentId ?? room.factoryFloor?.id ?? "unknown";
      const parentName = room.factoryFloor?.parent?.name ?? room.factoryFloor?.name ?? "現場";
      if (!map.has(parentId)) {
        map.set(parentId, { parentId, parentName, rooms: [], latestTime: null, totalUnread: 0 });
      }
      const group = map.get(parentId)!;
      group.rooms.push(room);
      group.totalUnread += room.unreadCount;
      const msgTime = room.lastMessage?.createdAt ? new Date(room.lastMessage.createdAt) : null;
      if (msgTime && (!group.latestTime || msgTime > group.latestTime)) {
        group.latestTime = msgTime;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (!a.latestTime && !b.latestTime) return 0;
      if (!a.latestTime) return 1;
      if (!b.latestTime) return -1;
      return b.latestTime.getTime() - a.latestTime.getTime();
    });
  }, [rooms]);

  const filtered = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups.filter((g) => {
      if (g.parentName.toLowerCase().includes(q)) return true;
      return g.rooms.some((r) => {
        const partner = r.orderCompany.id === myCompanyId ? r.workerCompany : r.orderCompany;
        return partner.name?.toLowerCase().includes(q) || r.factoryFloor?.name?.toLowerCase().includes(q);
      });
    });
  }, [groups, query, myCompanyId]);

  const totalUnread = rooms.reduce((s, r) => s + r.unreadCount, 0);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50">
      <header className="sticky top-0 z-40" style={{ backgroundColor: "#FEF3C7" }}>
        <div className="flex items-center gap-3 px-3 py-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-black/5"
          >
            <BackIcon />
          </button>
          <div className="flex flex-1 flex-col">
            <h1 className="text-[17px] font-bold text-knock-text">現場情報ルーム</h1>
            <p className="text-[12px]" style={{ color: "#D97706" }}>
              {groups.length} 現場
              {totalUnread > 0 && ` · 未読 ${totalUnread}`}
            </p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <SearchIcon />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="現場名・会社名で検索"
              className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder:text-gray-400 outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-gray-400">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pt-4 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-[14px] text-gray-400">
              {query ? "検索結果がありません" : "現場情報ルームがありません"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((group) => (
              <button
                key={group.parentId}
                onClick={() => onSelectParent(group.parentId)}
                className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98] w-full text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#FEF3C7" }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 7L10 3L17 7V15L10 19L3 15V7Z" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M10 11V19M3 7L10 11L17 7" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[14px] font-semibold text-knock-text">
                    {group.parentName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-knock-text-secondary">
                      {group.rooms.length}件の工事
                    </span>
                    {group.latestTime && (
                      <span className="text-[11px] text-knock-text-muted">
                        {formatDateTime(group.latestTime)}
                      </span>
                    )}
                  </div>
                </div>
                {group.totalUnread > 0 && (
                  <span className="flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ backgroundColor: "#EF4444" }}>
                    {group.totalUnread}
                  </span>
                )}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-gray-300">
                  <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Site Info: Child Room List View ─────────────────────

function SiteChildRoomListView({
  parentName,
  rooms,
  myCompanyId,
  onBack,
}: {
  parentName: string;
  rooms: ChatRoom[];
  myCompanyId: string;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return rooms;
    const q = query.toLowerCase();
    return rooms.filter((r) => {
      const partner = r.orderCompany.id === myCompanyId ? r.workerCompany : r.orderCompany;
      if (partner.name?.toLowerCase().includes(q)) return true;
      if (r.factoryFloor?.name?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [rooms, query, myCompanyId]);

  const totalUnread = rooms.reduce((s, r) => s + r.unreadCount, 0);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50">
      <header className="sticky top-0 z-40" style={{ backgroundColor: "#FEF3C7" }}>
        <div className="flex items-center gap-3 px-3 py-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-black/5"
          >
            <BackIcon />
          </button>
          <div className="flex flex-1 flex-col">
            <h1 className="truncate text-[17px] font-bold text-knock-text">{parentName}</h1>
            <p className="text-[12px]" style={{ color: "#D97706" }}>
              {rooms.length} 件
              {totalUnread > 0 && ` · 未読 ${totalUnread}`}
            </p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <SearchIcon />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="会社名・工事名で検索"
              className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder:text-gray-400 outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-gray-400">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pt-4 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-[14px] text-gray-400">
              {query ? "検索結果がありません" : "チャットルームがありません"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
            {filtered.map((room) => (
              <RoomRow key={room.id} room={room} myCompanyId={myCompanyId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────

export default function ChatPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("select");
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [myCompanyId, setMyCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const { accentColor } = useMode();

  useEffect(() => {
    setLoading(true);
    getChatRooms()
      .then((data) => {
        setMyCompanyId(data.myCompanyId);
        setRooms(data.rooms);
      })
      .finally(() => setLoading(false));
  }, []);

  const negotiationRooms = useMemo(
    () => rooms.filter((r) => r.type === "NEGOTIATION"),
    [rooms]
  );
  const siteInfoRooms = useMemo(
    () => rooms.filter((r) => r.type === "SITE_INFO"),
    [rooms]
  );

  const negotiationUnread = useMemo(
    () => negotiationRooms.reduce((s, r) => s + r.unreadCount, 0),
    [negotiationRooms]
  );
  const siteUnread = useMemo(
    () => siteInfoRooms.reduce((s, r) => s + r.unreadCount, 0),
    [siteInfoRooms]
  );

  // ── Room list sub-views ──
  if (viewMode === "NEGOTIATION") {
    return (
      <RoomListView
        type="NEGOTIATION"
        rooms={negotiationRooms}
        myCompanyId={myCompanyId}
        onBack={() => setViewMode("select")}
        accentColor="#3B82F6"
      />
    );
  }

  if (viewMode === "SITE_INFO") {
    if (selectedParentId) {
      const childRooms = siteInfoRooms.filter((r) => {
        const pid = r.factoryFloor?.parentId ?? r.factoryFloor?.id;
        return pid === selectedParentId;
      });
      const parentName = (() => {
        const first = childRooms[0];
        if (!first?.factoryFloor) return "現場";
        return first.factoryFloor.parent?.name ?? first.factoryFloor.name ?? "現場";
      })();
      return (
        <SiteChildRoomListView
          parentName={parentName}
          rooms={childRooms}
          myCompanyId={myCompanyId}
          onBack={() => setSelectedParentId(null)}
        />
      );
    }
    return (
      <SiteParentListView
        rooms={siteInfoRooms}
        myCompanyId={myCompanyId}
        onBack={() => setViewMode("select")}
        onSelectParent={setSelectedParentId}
      />
    );
  }

  // ── Selection view ──
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50">
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <MenuIcon />
          </button>

          <div className="flex flex-col items-center">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">
              チャット
            </h1>
            <div
              className="mt-0.5 h-[3px] w-8 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          </div>

          <Link
            href="/notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <BellIcon />
          </Link>
        </div>
      </header>

      {/* Cards */}
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        {/* 交渉ルーム */}
        <button
          onClick={() => setViewMode("NEGOTIATION")}
          className="relative flex flex-col items-center justify-center gap-4 rounded-2xl bg-white py-10 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98] w-full"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
            <HandshakeIllustration />
          </div>
          <span className="text-[17px] font-bold text-knock-text">
            交渉ルーム
          </span>
          {!loading && negotiationUnread > 0 && (
            <span className="absolute top-4 right-4 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-knock-red px-1.5 text-[11px] font-bold text-white">
              {negotiationUnread}
            </span>
          )}
        </button>

        {/* 現場情報ルーム */}
        <button
          onClick={() => setViewMode("SITE_INFO")}
          className="relative flex flex-col items-center justify-center gap-4 rounded-2xl bg-white py-10 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-all active:scale-[0.98] w-full"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-50">
            <MapIllustration />
          </div>
          <span className="text-[17px] font-bold text-knock-text">
            現場情報ルーム
          </span>
          {!loading && siteUnread > 0 && (
            <span className="absolute top-4 right-4 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-knock-red px-1.5 text-[11px] font-bold text-white">
              {siteUnread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
