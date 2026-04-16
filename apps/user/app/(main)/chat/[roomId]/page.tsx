"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getChatRoom, getNewMessages, sendMessage, sendFileMessage, markAsRead } from "@/lib/actions/chat";
import { formatDateTime, formatCurrency, documentTypeLabels } from "@knock/utils";

type ChatData = Awaited<ReturnType<typeof getChatRoom>>;
type Message = ChatData["messages"][number];

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getChatRoom(params.roomId as string)
      .then((chatData) => {
        setData(chatData);
        const currentMember = chatData.room.members.find((m) => m.userId);
        if (currentMember) setCurrentUserId(currentMember.userId);
      })
      .finally(() => setLoading(false));

    markAsRead(params.roomId as string);
  }, [params.roomId]);

  // 5秒ポーリング: カーソルベース(afterId) + IDベース重複排除
  useEffect(() => {
    if (!data || data.messages.length === 0) return;

    const roomId = params.roomId as string;
    let isMounted = true;

    const intervalId = setInterval(async () => {
      if (!isMounted) return;

      try {
        // 最後のメッセージIDをカーソルとして使用
        const lastMsg = data.messages[data.messages.length - 1];
        if (!lastMsg) return;

        const newMsgs = await getNewMessages(roomId, lastMsg.id);
        if (!isMounted || newMsgs.length === 0) return;

        setData((prev) => {
          if (!prev) return prev;
          // IDベース重複排除
          const existingIds = new Set(prev.messages.map((m) => m.id));
          const unique = (newMsgs as Message[]).filter((m) => !existingIds.has(m.id));
          if (unique.length === 0) return prev;
          return { ...prev, messages: [...prev.messages, ...unique] };
        });

        // 既読にする
        markAsRead(roomId);
      } catch {
        // ポーリングエラーは無視（ネットワーク断等）
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [params.roomId, data?.messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      const newMsg = await sendMessage(params.roomId as string, input.trim());
      setData((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, newMsg as Message] }
          : prev
      );
      setInput("");
    } finally {
      setSending(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      const { url } = await res.json();
      const newMsg = await sendFileMessage(params.roomId as string, url, file.name);
      setData((prev) =>
        prev ? { ...prev, messages: [...prev.messages, newMsg as Message] } : prev
      );
    } catch {
      // アップロードエラー
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!data) return null;

  const isSiteInfo = data.room.type === "SITE_INFO";
  const isNegotiation = data.room.type === "NEGOTIATION";
  const roomTitle =
    data.room.factoryFloor?.name ??
    `${data.room.orderCompany.name} × ${data.room.workerCompany.name}`;

  // 交渉ルーム: パートナー企業情報 & ロール判定
  const partnerCompanyId =
    data.myCompanyId === data.room.orderCompany.id
      ? data.room.workerCompany.id
      : data.room.orderCompany.id;
  const partnerCompanyName =
    data.myCompanyId === data.room.orderCompany.id
      ? data.room.workerCompany.name
      : data.room.orderCompany.name;
  const isOrderer = data.myCompanyType === "ORDERER" || data.myCompanyType === "BOTH";

  // Collect documents from all orders
  const allDocuments = data.room.factoryFloor?.orders?.flatMap(
    (order) => order.documents?.map((doc) => ({ ...doc, orderId: order.id })) ?? []
  ) ?? [];

  // Get first order for linking to completion report
  const firstOrder = data.room.factoryFloor?.orders?.[0];

  function renderActionMessage(msg: Message) {
    const isOrderRequest = msg.actionType === "ORDER_REQUEST";
    const isReject = isOrderRequest && msg.message?.includes("辞退");
    const isCancel = isOrderRequest && msg.message?.includes("キャンセル");
    const isNegative = isReject || isCancel;
    const bgColor = isNegative
      ? "bg-red-50 border-red-200"
      : isOrderRequest ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200";
    const iconColor = isNegative
      ? "text-red-500"
      : isOrderRequest ? "text-blue-500" : "text-green-500";
    const textColor = isNegative
      ? "text-red-700"
      : isOrderRequest ? "text-blue-700" : "text-green-700";
    const linkColor = isOrderRequest ? "text-blue-500" : "text-green-500";

    const keyCollection = (msg as Record<string, unknown>).keyCollection as string | null;
    // 注文書発行メッセージ: keyCollection = documentId → 注文書を確認リンク
    // 受注了承メッセージ: keyCollection = siteRoomId → 現場ルームへリンク
    const isDocumentLink = msg.message?.includes("注文書") && keyCollection;

    return (
      <div key={msg.id} className="flex justify-center py-1">
        <div className={`w-full max-w-[85%] rounded-xl border ${bgColor} p-3`}>
          <div className="flex items-center gap-2">
            <span className={`text-[16px] ${iconColor}`}>
              {isReject ? "\u{274C}" : isOrderRequest ? "\u{1F4CB}" : "\u{2705}"}
            </span>
            <span className={`text-[13px] font-bold ${textColor}`}>
              {msg.message}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            {msg.factoryFloorOrderId && !isReject && !isCancel && (
              <Link
                href={`/orders/${msg.factoryFloorOrderId}`}
                className={`text-[12px] font-semibold ${linkColor}`}
              >
                {"詳細を確認する \u2192"}
              </Link>
            )}
            {isCancel && keyCollection && (
              <Link
                href={`/sites/${keyCollection}`}
                className="text-[12px] font-semibold text-red-500"
              >
                {"現場を確認する \u2192"}
              </Link>
            )}
            {isDocumentLink ? (
              <Link
                href={`/documents/${keyCollection}`}
                className="text-[12px] font-semibold text-green-600"
              >
                {"注文書を確認 \u2192"}
              </Link>
            ) : keyCollection ? (
              <Link
                href={`/chat/${keyCollection}`}
                className="text-[12px] font-semibold text-green-600"
              >
                {"現場ルームへ \u2192"}
              </Link>
            ) : null}
          </div>
          <div className="mt-1 text-[10px] text-gray-400">
            {msg.user.lastName} {msg.user.firstName} - {formatDateTime(new Date(msg.createdAt))}
          </div>
        </div>
      </div>
    );
  }

  function renderFileMessage(msg: Message) {
    const isOwn = msg.user.id === currentUserId;
    const fileUrl = (msg as Record<string, unknown>).file as string | null;
    const fileName = msg.message ?? "ファイル";
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);

    return (
      <div
        key={msg.id}
        className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      >
        {!isOwn && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-500">
            {msg.user.lastName?.charAt(0)}
          </div>
        )}
        <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
          {!isOwn && (
            <span className="text-[11px] text-knock-text-secondary">
              {msg.user.lastName} {msg.user.firstName}
            </span>
          )}
          {isImage && fileUrl ? (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-gray-200">
              <img src={fileUrl} alt={fileName} className="max-h-[200px] w-auto object-cover" />
            </a>
          ) : fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 ${
                isOwn ? "bg-knock-orange text-white" : "bg-[#F0F0F0] text-knock-text"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 1H10L14 5V13C14 14.1 13.1 15 12 15H4C2.9 15 2 14.1 2 13V3C2 1.9 2.9 1 4 1Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <path d="M10 1V5H14" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              </svg>
              <span className="text-[13px] underline">{fileName}</span>
            </a>
          ) : (
            <div className="rounded-2xl bg-[#F0F0F0] px-3.5 py-2.5 text-[14px] text-knock-text">
              {fileName}
            </div>
          )}
          <span className="text-[10px] text-knock-text-muted">
            {formatDateTime(new Date(msg.createdAt))}
          </span>
        </div>
      </div>
    );
  }

  function renderTextMessage(msg: Message) {
    const isOwn = msg.user.id === currentUserId;
    return (
      <div
        key={msg.id}
        className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      >
        {!isOwn && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-500">
            {msg.user.lastName?.charAt(0)}
          </div>
        )}
        <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
          {!isOwn && (
            <span className="text-[11px] text-knock-text-secondary">
              {msg.user.lastName} {msg.user.firstName}
            </span>
          )}
          <div
            className={`rounded-2xl px-3.5 py-2.5 text-[14px] ${
              isOwn
                ? "bg-knock-orange text-white"
                : "bg-[#F0F0F0] text-knock-text"
            }`}
          >
            {msg.message}
          </div>
          <span className="text-[10px] text-knock-text-muted">
            {formatDateTime(new Date(msg.createdAt))}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-80px)] flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold text-knock-text">{roomTitle}</h1>
            <p className="text-[11px] text-knock-text-secondary">
              {data.room.members.length}人のメンバー
            </p>
          </div>
          {isSiteInfo && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="4" r="1.5" fill="#666" />
                  <circle cx="10" cy="10" r="1.5" fill="#666" />
                  <circle cx="10" cy="16" r="1.5" fill="#666" />
                </svg>
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      onClick={() => { setShowDocuments(true); setShowMenu(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] text-knock-text active:bg-gray-50"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 1H10L14 5V13C14 14.1 13.1 15 12 15H4C2.9 15 2 14.1 2 13V3C2 1.9 2.9 1 4 1Z" stroke="#666" strokeWidth="1.2" fill="none"/>
                        <path d="M10 1V5H14" stroke="#666" strokeWidth="1.2" fill="none"/>
                      </svg>
                      帳票確認
                    </button>
                    {/* 受注者: 完了報告を送信 */}
                    {firstOrder && !isOrderer && firstOrder.status === "CONFIRMED" && (
                      <button
                        onClick={() => { router.push(`/orders/${firstOrder.id}/completion-report`); setShowMenu(false); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] text-knock-text active:bg-gray-50"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M6 8L7.5 9.5L10 6.5" stroke="#666" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="8" cy="8" r="6.5" stroke="#666" strokeWidth="1.2" fill="none"/>
                        </svg>
                        完了報告
                      </button>
                    )}
                    {/* 発注者: 完了報告を確認 */}
                    {firstOrder && isOrderer && data.room.factoryFloor?.status === "INSPECTION" && (
                      <button
                        onClick={() => { router.push(`/orders/${firstOrder.id}/completion-review`); setShowMenu(false); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] text-knock-text active:bg-gray-50"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M6 8L7.5 9.5L10 6.5" stroke="#666" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="8" cy="8" r="6.5" stroke="#666" strokeWidth="1.2" fill="none"/>
                        </svg>
                        完了報告を確認
                      </button>
                    )}
                    <button
                      onClick={() => { fileInputRef.current?.click(); setShowMenu(false); }}
                      disabled={uploading}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] text-knock-text active:bg-gray-50 disabled:opacity-40"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <rect x="1.5" y="3" width="13" height="10" rx="1" stroke="#666" strokeWidth="1.2" fill="none"/>
                        <circle cx="6" cy="7" r="1.5" stroke="#666" strokeWidth="1" fill="none"/>
                        <path d="M1.5 11L5 8.5L7.5 10.5L10.5 7L14.5 10.5" stroke="#666" strokeWidth="1"/>
                      </svg>
                      {uploading ? "アップロード中..." : "写真・ファイル共有"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {data.messages.map((msg) => {
            if (msg.type === "ACTION") {
              return renderActionMessage(msg);
            }
            if (msg.type === "FILE") {
              return renderFileMessage(msg);
            }
            return renderTextMessage(msg);
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 pb-[env(safe-area-inset-bottom,12px)]"
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 transition-all active:scale-95 disabled:opacity-40"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M19 10.5L11 18.5C9.14 20.36 6.14 20.36 4.28 18.5C2.42 16.64 2.42 13.64 4.28 11.78L12.28 3.78C13.46 2.6 15.38 2.6 16.56 3.78C17.74 4.96 17.74 6.88 16.56 8.06L8.57 16.05C7.99 16.63 7.03 16.63 6.45 16.05C5.87 15.47 5.87 14.51 6.45 13.93L13.72 6.66" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 rounded-full bg-[#F0F0F0] px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-knock-orange/40"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-knock-orange text-white transition-all active:scale-95 disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M16 2L8 10M16 2L11 16L8 10M16 2L2 7L8 10" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </form>

      {/* Negotiation Action Sheet — V1: bottom panel with ∧ toggle */}
      {isNegotiation && (
        <div className="shrink-0 border-t border-gray-200 bg-white">
          {/* Toggle button */}
          <button
            onClick={() => setShowActionSheet(!showActionSheet)}
            className="flex w-full items-center justify-center py-1.5 active:bg-gray-50"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className={`text-gray-400 transition-transform ${showActionSheet ? "rotate-180" : ""}`}
            >
              <path d="M5 13L10 8L15 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {showActionSheet && (
            <div className="border-t border-gray-200 pb-[env(safe-area-inset-bottom,8px)]">
              {/* Header — V1: ← 会社名さま */}
              <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
                <button
                  onClick={() => setShowActionSheet(false)}
                  className="flex h-8 w-8 items-center justify-center"
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M14 4L7 11L14 18" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="text-[16px] font-bold text-knock-text">
                  {partnerCompanyName}さま
                </span>
              </div>

              {/* Action buttons — V1: bare icons without bg circle */}
              <div className={`flex items-center ${isOrderer ? "justify-center gap-16" : "justify-start pl-8"} px-4 py-5`}>
                {isOrderer && (
                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      router.push(`/chat/${params.roomId}/select-site?companyId=${partnerCompanyId}`);
                    }}
                    className="flex flex-col items-center gap-2 active:opacity-70"
                  >
                    {/* V1 icon: speech bubble with + */}
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                      <path d="M18 6C10.82 6 5 10.48 5 16C5 19.12 7.02 21.9 10 23.68V30L16.18 26.56C16.78 26.64 17.38 26.68 18 26.68C25.18 26.68 31 22.2 31 16.68C31 11.16 25.18 6 18 6Z" stroke="#555" strokeWidth="1.5" fill="none" />
                      <path d="M14 16H22M18 12V20" stroke="#555" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <span className="text-[12px] font-bold text-knock-text">発注依頼</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowActionSheet(false);
                    router.push(`/chat/${params.roomId}/orders?companyId=${partnerCompanyId}`);
                  }}
                  className="flex flex-col items-center gap-2 active:opacity-70"
                >
                  {/* V1 icon: clipboard with checkmarks */}
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <path d="M11 8H9C7.9 8 7 8.9 7 10V28C7 29.1 7.9 30 9 30H27C28.1 30 29 29.1 29 28V10C29 8.9 28.1 8 27 8H25" stroke="#555" strokeWidth="1.5" fill="none" />
                    <path d="M14 8C14 6.34 15.34 5 17 5H19C20.66 5 22 6.34 22 8C22 9.66 20.66 11 19 11H17C15.34 11 14 9.66 14 8Z" stroke="#555" strokeWidth="1.5" fill="none" />
                    <path d="M12 17L15 20L24 14" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 24H24" stroke="#555" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <span className="text-[12px] font-bold text-knock-text">
                    {isOrderer ? "発注一覧" : "受注一覧"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Document Panel (Bottom Sheet) */}
      {showDocuments && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowDocuments(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom,16px)]">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
              <h2 className="text-[16px] font-bold text-knock-text">帳票一覧</h2>
              <button
                onClick={() => setShowDocuments(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full active:bg-gray-100"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-2 p-4">
              {allDocuments.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-knock-text-muted">
                  帳票はまだありません
                </p>
              ) : (
                allDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    onClick={() => setShowDocuments(false)}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 transition-colors active:bg-gray-100"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      doc.type === "ORDER_SHEET" ? "bg-blue-100 text-blue-600"
                      : doc.type === "DELIVERY_NOTE" ? "bg-green-100 text-green-600"
                      : "bg-amber-100 text-amber-600"
                    }`}>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M5 1H11L15 5V15C15 16.1 14.1 17 13 17H5C3.9 17 3 16.1 3 15V3C3 1.9 3.9 1 5 1Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                        <path d="M11 1V5H15" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-knock-text">
                        {documentTypeLabels[doc.type] ?? doc.type}
                      </p>
                      <p className="text-[11px] text-knock-text-secondary">
                        {doc.documentNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-knock-text">
                        {doc.totalAmount != null ? formatCurrency(Number(doc.totalAmount)) : "-"}
                      </p>
                      {doc.issuedAt && (
                        <p className="text-[10px] text-knock-text-muted">
                          {new Date(doc.issuedAt).toLocaleDateString("ja-JP")}
                        </p>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
