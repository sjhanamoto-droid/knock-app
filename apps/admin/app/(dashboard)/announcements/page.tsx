"use client";

import { useEffect, useState } from "react";
import {
  broadcastAnnouncement,
  countAnnouncementRecipients,
  type AnnouncementTarget,
} from "@/lib/actions/announcements";

const inputCls =
  "w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-knock-orange/20 focus:outline-none";

const TARGETS: { value: AnnouncementTarget; label: string; desc: string }[] = [
  { value: "ALL", label: "全ユーザー", desc: "発注者・受注者すべてに送信" },
  { value: "ORDERER", label: "発注者", desc: "発注者（両方を含む）に送信" },
  { value: "CONTRACTOR", label: "受注者", desc: "受注者（両方を含む）に送信" },
];

export default function AnnouncementsPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [target, setTarget] = useState<AnnouncementTarget>("ALL");
  const [count, setCount] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 対象が変わるたびに送信人数を取得
  useEffect(() => {
    let active = true;
    setCount(null);
    countAnnouncementRecipients(target)
      .then((n) => {
        if (active) setCount(n);
      })
      .catch(() => {
        if (active) setCount(null);
      });
    return () => {
      active = false;
    };
  }, [target]);

  const targetLabel = TARGETS.find((t) => t.value === target)?.label ?? "";

  function handleOpenConfirm() {
    setError("");
    setSuccess("");
    if (!title.trim() || !content.trim()) {
      setError("タイトルと内容を入力してください");
      return;
    }
    setConfirming(true);
  }

  async function handleSend() {
    setSending(true);
    setError("");
    try {
      const res = await broadcastAnnouncement({ title, content, target });
      if (!res.success) {
        setError(res.error ?? "送信に失敗しました");
        setConfirming(false);
        return;
      }
      setSuccess(`${targetLabel}（${res.count}名）にお知らせを送信しました`);
      setConfirming(false);
      setTitle("");
      setContent("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="text-[24px] font-bold text-gray-900">お知らせ配信</h1>
      <p className="mt-1 text-[14px] text-gray-500">
        ユーザーへ一斉にお知らせを送信します。送信後は各ユーザーの通知一覧に表示されます。
      </p>

      {success && (
        <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-[13px] font-medium text-green-700">
          {success}
        </div>
      )}

      <div className="mt-5 rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
            {error}
          </div>
        )}

        {/* 送信対象 */}
        <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">送信対象</label>
        <div className="mb-5 grid grid-cols-3 gap-3">
          {TARGETS.map((t) => {
            const selected = target === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTarget(t.value)}
                className={`rounded-xl border-2 p-3 text-left transition-colors ${
                  selected
                    ? "border-knock-orange bg-knock-orange/5"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span className={`block text-[14px] font-bold ${selected ? "text-knock-orange" : "text-gray-700"}`}>
                  {t.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-gray-400">{t.desc}</span>
              </button>
            );
          })}
        </div>

        <div className="mb-5 rounded-xl bg-[#F7F7F7] px-4 py-3 text-[13px] text-gray-600">
          送信人数:{" "}
          <span className="font-bold text-gray-900">
            {count === null ? "集計中..." : `${count} 名`}
          </span>
        </div>

        {/* タイトル */}
        <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">タイトル</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: メンテナンスのお知らせ"
          className={`${inputCls} mb-5`}
          maxLength={100}
        />

        {/* 内容 */}
        <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">内容</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="お知らせの内容を入力してください"
          className={`${inputCls} mb-5 resize-none`}
          maxLength={2000}
        />

        <button
          type="button"
          onClick={handleOpenConfirm}
          className="w-full rounded-xl bg-knock-orange px-5 py-3 text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-knock-amber"
        >
          内容を確認して送信
        </button>
      </div>

      {/* 送信前の確認 */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !sending && setConfirming(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-bold text-gray-900">送信内容の確認</h2>
            <div className="mt-4 flex flex-col gap-2 rounded-xl bg-[#F7F7F7] p-4 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="shrink-0 text-gray-500">対象</span>
                <span className="text-right font-semibold text-gray-900">
                  {targetLabel}（{count ?? "—"} 名）
                </span>
              </div>
              <div>
                <span className="text-gray-500">タイトル</span>
                <p className="mt-0.5 font-semibold text-gray-900 break-words">{title}</p>
              </div>
              <div>
                <span className="text-gray-500">内容</span>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-gray-700">{content}</p>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-gray-500">
              送信すると取り消せません。よろしいですか？
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="flex-1 rounded-xl bg-knock-orange px-4 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-knock-amber disabled:opacity-50"
              >
                {sending ? "送信中..." : "送信する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
