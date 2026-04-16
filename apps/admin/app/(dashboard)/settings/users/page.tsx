"use client";

import { useState, useEffect } from "react";
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  deleteAdminUser,
} from "@/lib/actions/settings";

type AdminUser = Awaited<ReturnType<typeof getAdminUsers>>[number];

const inputCls =
  "w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:ring-2 focus:ring-knock-blue/20 focus:outline-none";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    getAdminUsers()
      .then(setUsers)
      .catch((err) => console.error("[AdminUsers] fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    try {
      await createAdminUser({
        lastName: fd.get("lastName") as string,
        firstName: fd.get("firstName") as string,
        email: fd.get("email") as string,
        password: fd.get("password") as string,
        roleId: Number(fd.get("roleId")),
      });
      const updated = await getAdminUsers();
      setUsers(updated);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このスタッフを削除しますか？")) return;
    await deleteAdminUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => history.back()}
            className="mb-2 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            設定に戻る
          </button>
          <h1 className="text-[24px] font-bold text-gray-900">運営者管理</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            管理画面にログインできるスタッフを管理します
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-knock-amber transition-colors"
        >
          {showForm ? "閉じる" : "+ スタッフ追加"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
        >
          <h3 className="mb-4 text-[14px] font-bold text-gray-900">
            新規スタッフ
          </h3>
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                姓 *
              </label>
              <input name="lastName" required className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                名 *
              </label>
              <input name="firstName" required className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                メール *
              </label>
              <input
                name="email"
                type="email"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                パスワード *
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className={inputCls}
                placeholder="8文字以上"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">
                権限 *
              </label>
              <select
                name="roleId"
                required
                className={inputCls + " appearance-none"}
              >
                <option value="1">スタッフ</option>
                <option value="99">管理者</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={formLoading}
              className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-knock-amber transition-colors disabled:opacity-50"
            >
              {formLoading ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border-none bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                名前
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                メール
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                権限
              </th>
              <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                状態
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
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-[13px] text-gray-400"
                >
                  スタッフがいません
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-900">
                    {user.lastName} {user.firstName}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {user.roleId === 99 ? "管理者" : "スタッフ"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[12px] font-medium ${user.isActive ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {user.isActive ? "有効" : "無効"}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() =>
                        setEditingId(editingId === user.id ? null : user.id)
                      }
                      className="text-[12px] font-medium text-knock-blue hover:underline"
                    >
                      {editingId === user.id ? "閉じる" : "編集"}
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
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
      </div>

      {/* Edit Form */}
      {editingId && (
        <AdminUserEditForm
          user={users.find((u) => u.id === editingId)!}
          onSaved={(updated) => {
            setUsers((prev) =>
              prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
            );
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function AdminUserEditForm({
  user,
  onSaved,
  onCancel,
}: {
  user: AdminUser;
  onSaved: (u: Partial<AdminUser> & { id: string }) => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [form, setForm] = useState({
    lastName: user.lastName,
    firstName: user.firstName,
    email: user.email,
    roleId: user.roleId,
    isActive: user.isActive,
  });
  const [newPassword, setNewPassword] = useState("");

  function set(key: string, value: string | boolean | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateAdminUser(user.id, {
        lastName: form.lastName,
        firstName: form.firstName,
        email: form.email,
        roleId: form.roleId,
        isActive: form.isActive,
      });
      onSaved({
        id: user.id,
        lastName: form.lastName,
        firstName: form.firstName,
        email: form.email,
        roleId: form.roleId,
        isActive: form.isActive,
      });
    } catch (err) {
      console.error("[AdminUserEdit] error:", err);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!newPassword || newPassword.length < 8) {
      alert("パスワードは8文字以上で入力してください");
      return;
    }
    if (!confirm("パスワードをリセットしますか？")) return;
    setPwSaving(true);
    try {
      await resetAdminUserPassword(user.id, newPassword);
      setNewPassword("");
      setPwDone(true);
      setTimeout(() => setPwDone(false), 3000);
    } catch (err) {
      console.error("[AdminUserEdit] pw reset error:", err);
      alert("パスワードリセットに失敗しました");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <h3 className="mb-4 text-[14px] font-bold text-gray-900">
        スタッフ情報を編集: {user.lastName} {user.firstName}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-[13px] font-semibold text-gray-600">
            姓
          </label>
          <input
            className={inputCls}
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-semibold text-gray-600">
            名
          </label>
          <input
            className={inputCls}
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-semibold text-gray-600">
            メール
          </label>
          <input
            type="email"
            className={inputCls}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-semibold text-gray-600">
            権限
          </label>
          <select
            className={inputCls + " appearance-none"}
            value={form.roleId}
            onChange={(e) => set("roleId", Number(e.target.value))}
          >
            <option value={1}>スタッフ</option>
            <option value={99}>管理者</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-semibold text-gray-600">
            状態
          </label>
          <select
            className={inputCls + " appearance-none"}
            value={form.isActive ? "true" : "false"}
            onChange={(e) => set("isActive", e.target.value === "true")}
          >
            <option value="true">有効</option>
            <option value="false">無効</option>
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
          className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-knock-amber transition-colors disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      {/* Password Reset */}
      <div className="mt-5 border-t border-gray-200 pt-4">
        <h4 className="mb-2 text-[13px] font-bold text-gray-900">
          パスワードリセット
        </h4>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-[13px] font-semibold text-gray-600">
              新しいパスワード
            </label>
            <input
              type="text"
              className={inputCls}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8文字以上"
            />
          </div>
          <button
            onClick={handlePasswordReset}
            disabled={pwSaving || !newPassword}
            className="shrink-0 rounded-xl border border-red-200 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {pwSaving ? "リセット中..." : pwDone ? "完了 ✓" : "リセット"}
          </button>
        </div>
      </div>
    </div>
  );
}
