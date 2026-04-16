"use client";

import { useState, useEffect } from "react";
import {
  getNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
} from "@/lib/actions/settings";
import { formatDate } from "@knock/utils";

type NotificationList = Awaited<ReturnType<typeof getNotifications>>;
type NotificationItem = NotificationList["notifications"][number];

const inputCls =
  "w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-knock-blue/20 focus:outline-none";

const notificationTypeLabels: Record<number, string> = {
  1: "お知らせ",
  2: "システム",
  3: "重要",
};

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationList | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getNotifications({ page })
      .then(setData)
      .catch((err) => console.error("[Notifications] fetch error:", err))
      .finally(() => setLoading(false));
  }, [page]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    try {
      await createNotification({
        title: fd.get("title") as string,
        content: fd.get("content") as string,
        type: Number(fd.get("type")),
        userId: fd.get("userId") as string,
        urlRedirect: (fd.get("urlRedirect") as string) || undefined,
      });
      const updated = await getNotifications({ page });
      setData(updated);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("この通知を削除しますか？")) return;
    await deleteNotification(id);
    const updated = await getNotifications({ page });
    setData(updated);
  }

  const notifications = data?.notifications ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => history.back()}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            設定に戻る
          </button>
          <h1 className="mt-1 text-[24px] font-bold text-gray-900">通知管理</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            {data ? `${data.total}件の通知` : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-knock-amber transition-colors"
        >
          {showForm ? "閉じる" : "+ 通知を作成"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
        >
          <h3 className="mb-4 text-[15px] font-bold text-gray-900">
            新規通知
          </h3>
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                タイトル *
              </label>
              <input name="title" required className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                内容 *
              </label>
              <textarea
                name="content"
                required
                rows={4}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                種別 *
              </label>
              <select name="type" required className={inputCls + " appearance-none"}>
                <option value="1">お知らせ</option>
                <option value="2">システム</option>
                <option value="3">重要</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                対象ユーザーID *
              </label>
              <input
                name="userId"
                required
                className={inputCls}
                placeholder="ユーザーIDを入力"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                リダイレクトURL
              </label>
              <input
                name="urlRedirect"
                className={inputCls}
                placeholder="例: /projects/xxx"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={formLoading}
              className="rounded-xl bg-knock-orange px-6 py-2.5 text-[13px] font-bold text-white hover:bg-knock-amber disabled:opacity-50"
            >
              {formLoading ? "作成中..." : "作成"}
            </button>
          </div>
        </form>
      )}

      {/* Notifications Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border-none bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                タイトル
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                種別
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                対象ユーザー
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                作成日
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-[13px] text-gray-400"
                >
                  読み込み中...
                </td>
              </tr>
            ) : notifications.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-[13px] text-gray-400"
                >
                  通知がありません
                </td>
              </tr>
            ) : (
              notifications.map((n) => (
                <tr
                  key={n.id}
                  className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-medium text-gray-900">
                      {n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-gray-500">
                      {n.content}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        n.type === 3
                          ? "bg-red-100 text-red-700"
                          : n.type === 2
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {notificationTypeLabels[n.type] ?? `タイプ${n.type}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">
                    {n.user.lastName} {n.user.firstName}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">
                    {formatDate(new Date(n.createdAt))}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() =>
                        setEditingId(editingId === n.id ? null : n.id)
                      }
                      className="text-[12px] font-medium text-knock-blue hover:underline"
                    >
                      {editingId === n.id ? "閉じる" : "編集"}
                    </button>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="text-[12px] font-medium text-red-500 hover:underline"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <span className="text-[12px] text-gray-500">
              {page} / {data.totalPages} ページ
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-600 disabled:opacity-40"
              >
                前へ
              </button>
              <button
                onClick={() =>
                  setPage((p) => Math.min(data.totalPages, p + 1))
                }
                disabled={page >= data.totalPages}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-600 disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Form */}
      {editingId && (
        <NotificationEditForm
          notification={notifications.find((n) => n.id === editingId)!}
          onSaved={async () => {
            const updated = await getNotifications({ page });
            setData(updated);
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function NotificationEditForm({
  notification,
  onSaved,
  onCancel,
}: {
  notification: NotificationItem;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: notification.title,
    content: notification.content,
    type: notification.type,
    urlRedirect: "",
  });

  function set(key: string, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateNotification(notification.id, {
        title: form.title,
        content: form.content,
        type: form.type,
      });
      onSaved();
    } catch (err) {
      console.error("[NotificationEdit] error:", err);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <h3 className="mb-4 text-[15px] font-bold text-gray-900">通知を編集</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="mb-1 block text-[13px] font-semibold text-gray-600">
            タイトル
          </label>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-[13px] font-semibold text-gray-600">
            内容
          </label>
          <textarea
            className={inputCls}
            rows={4}
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-semibold text-gray-600">
            種別
          </label>
          <select
            className={inputCls + " appearance-none"}
            value={form.type}
            onChange={(e) => set("type", Number(e.target.value))}
          >
            <option value={1}>お知らせ</option>
            <option value={2}>システム</option>
            <option value={3}>重要</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-gray-200 px-5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-knock-orange px-6 py-2.5 text-[13px] font-bold text-white hover:bg-knock-amber disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
