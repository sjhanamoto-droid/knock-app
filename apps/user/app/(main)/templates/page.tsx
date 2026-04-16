"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getTemplates, deleteTemplate } from "@/lib/actions/templates";
import { useMode } from "@/lib/hooks/use-mode";

type Template = Awaited<ReturnType<typeof getTemplates>>[number];

export default function TemplatesPage() {
  const { accentColor } = useMode();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("このテンプレートを削除しますか？")) return;
    await deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="w-10" />
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">テンプレート</h1>
            <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
              <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={accentColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <Link
            href="/templates/new"
            className="rounded-full bg-knock-orange px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-all active:scale-95"
          >
            + 新規作成
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-2.5 bg-[#F5F5F5] px-4 pt-3 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white py-12 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="6" y="6" width="28" height="28" rx="4" stroke="#D1D5DB" strokeWidth="1.8" />
              <path d="M12 14H28M12 20H28M12 26H20" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[13px] text-knock-text-muted">テンプレートがありません</span>
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[14px] font-semibold text-knock-text">
                    {template.name ?? "名称未設定"}
                  </h3>
                  <p className="mt-1 text-[13px] text-knock-text-secondary line-clamp-2">
                    {template.content}
                  </p>
                </div>
                <div className="ml-3 flex shrink-0 gap-2">
                  <Link
                    href={`/templates/${template.id}/edit`}
                    className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-[12px] font-medium text-gray-600"
                  >
                    編集
                  </Link>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] font-medium text-red-600"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
