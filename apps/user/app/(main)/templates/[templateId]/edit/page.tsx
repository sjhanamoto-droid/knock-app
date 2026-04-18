"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTemplate, updateTemplate } from "@/lib/actions/templates";
import { useMode } from "@/lib/hooks/use-mode";

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const { accentColor } = useMode();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ name: "", content: "" });

  useEffect(() => {
    getTemplate(params.templateId as string).then((t) => {
      if (t) setFormData({ name: t.name ?? "", content: t.content ?? "" });
      setLoading(false);
    });
  }, [params.templateId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      await updateTemplate(params.templateId as string, {
        name: formData.name,
        content: formData.content,
      });
      router.replace("/templates");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
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
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">テンプレート編集</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>
        )}

        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">テンプレート名</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">内容</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
                rows={6}
                className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px]"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-knock-orange py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "保存中..." : "変更を保存"}
        </button>
      </form>
    </div>
  );
}
