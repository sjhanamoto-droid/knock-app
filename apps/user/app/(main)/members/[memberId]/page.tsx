"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMember, updateMember, deleteMember } from "@/lib/actions/members";
import { userRoleLabels } from "@knock/utils";
import { useMode } from "@/lib/hooks/use-mode";

type MemberDetail = Awaited<ReturnType<typeof getMember>>;

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accentColor } = useMode();
  const [member, setMember] = useState<MemberDetail>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    lastName: "",
    firstName: "",
    email: "",
    telNumber: "",
    role: "OTHER" as string,
    isActive: true,
  });

  useEffect(() => {
    getMember(params.memberId as string).then((m) => {
      setMember(m);
      if (m) {
        setFormData({
          lastName: m.lastName,
          firstName: m.firstName,
          email: m.email,
          telNumber: m.telNumber ?? "",
          role: m.role,
          isActive: m.isActive,
        });
      }
      setLoading(false);
    });
  }, [params.memberId]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await updateMember(params.memberId as string, {
        lastName: formData.lastName,
        firstName: formData.firstName,
        email: formData.email,
        telNumber: formData.telNumber || undefined,
        role: formData.role as "REPRESENTATIVE" | "MANAGER" | "OTHER",
        isActive: formData.isActive,
      });
      const updated = await getMember(params.memberId as string);
      setMember(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("このメンバーを削除しますか？")) return;
    try {
      await deleteMember(params.memberId as string);
      router.push("/members");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <span className="text-[14px] text-gray-400">メンバーが見つかりません</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">メンバー詳細</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} className="rounded-lg bg-gray-100 px-3 py-2 text-[13px] font-medium text-gray-700">編集</button>
                <button onClick={handleDelete} className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">削除</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="rounded-lg bg-gray-100 px-3 py-2 text-[13px] font-medium text-gray-700">キャンセル</button>
                <button onClick={handleSave} disabled={saving} className="rounded-lg bg-knock-orange px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50">保存</button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>
        )}

        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          {!editing ? (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-[18px] font-bold text-gray-500">
                  {member.lastName?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-knock-text">{member.lastName} {member.firstName}</h2>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                    {userRoleLabels[member.role] ?? member.role}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between"><span className="text-[12px] text-knock-text-secondary">メール</span><span className="text-[14px]">{member.email}</span></div>
                {member.telNumber && <div className="flex justify-between"><span className="text-[12px] text-knock-text-secondary">電話</span><span className="text-[14px]">{member.telNumber}</span></div>}
                <div className="flex justify-between"><span className="text-[12px] text-knock-text-secondary">状態</span><span className={`text-[14px] font-medium ${member.isActive ? "text-emerald-600" : "text-red-500"}`}>{member.isActive ? "有効" : "無効"}</span></div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">姓</label>
                  <input value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">名</label>
                  <input value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">メール</label>
                <input value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">電話</label>
                <input value={formData.telNumber} onChange={(e) => setFormData({...formData, telNumber: e.target.value})} className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">権限</label>
                <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:outline-none">
                  <option value="REPRESENTATIVE">代表者</option>
                  <option value="MANAGER">管理者</option>
                  <option value="OTHER">一般</option>
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({...formData, isActive: e.target.checked})} className="rounded" />
                <span className="text-[14px] text-gray-700">アカウント有効</span>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
