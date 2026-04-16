"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAdminCompany, updateAdminCompany } from "@/lib/actions/settings";

type AdminCompany = Awaited<ReturnType<typeof getAdminCompany>>;

export default function SettingsPage() {
  const [company, setCompany] = useState<AdminCompany>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    getAdminCompany().then((c) => {
      setCompany(c);
      if (c) {
        setFormData({
          name: c.name ?? "",
          email: c.email ?? "",
          nameKana: c.nameKana ?? "",
          invoiceNumber: c.invoiceNumber ?? "",
          postalCode: c.postalCode ?? "",
          city: c.city ?? "",
          streetAddress: c.streetAddress ?? "",
          building: c.building ?? "",
          telNumber: c.telNumber ?? "",
          hpUrl: c.hpUrl ?? "",
        });
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await updateAdminCompany({
        name: formData.name,
        email: formData.email,
        nameKana: formData.nameKana || undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
        postalCode: formData.postalCode || undefined,
        city: formData.city || undefined,
        streetAddress: formData.streetAddress || undefined,
        building: formData.building || undefined,
        telNumber: formData.telNumber || undefined,
        hpUrl: formData.hpUrl || undefined,
      });
      const updated = await getAdminCompany();
      setCompany(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" /></div>;
  }

  const settingsMenu = [
    { href: "/settings/users", label: "運営者管理", desc: "管理画面にログインできるスタッフの追加・編集" },
    { href: "/settings/plans", label: "プラン管理", desc: "発注者・受注者の契約プランの管理" },
    { href: "/settings/notifications", label: "通知管理", desc: "ユーザーへのお知らせの作成・編集" },
    { href: "/settings/contracts", label: "企業契約", desc: "企業の契約状況の確認" },
  ];

  return (
    <div>
      <h1 className="text-[24px] font-bold text-gray-900">設定</h1>

      {/* Quick Links */}
      <div className="mt-5 grid grid-cols-3 gap-4">
        {settingsMenu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:border-knock-orange"
          >
            <h3 className="text-[14px] font-bold text-gray-900">{item.label}</h3>
            <p className="mt-1 text-[12px] text-gray-500">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Company Info */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-gray-900">会社情報</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="rounded-xl border border-gray-300 px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50">編集</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="rounded-xl border border-gray-300 px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50">キャンセル</button>
              <button onClick={handleSave} disabled={saving} className="bg-knock-orange rounded-xl px-5 py-2.5 text-[13px] font-bold text-white hover:bg-knock-amber disabled:opacity-50">保存</button>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-2xl border-none bg-white p-5 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          {!editing ? (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "会社名", value: company?.name },
                { label: "メール", value: company?.email },
                { label: "フリガナ", value: company?.nameKana },
                { label: "適格請求書番号", value: company?.invoiceNumber },
                { label: "郵便番号", value: company?.postalCode },
                { label: "住所", value: [company?.city, company?.streetAddress, company?.building].filter(Boolean).join(" ") },
                { label: "電話番号", value: company?.telNumber },
                { label: "HP URL", value: company?.hpUrl },
              ].map((item) => (
                <div key={item.label}>
                  <span className="text-[12px] font-medium text-gray-400">{item.label}</span>
                  <p className="mt-0.5 text-[14px] font-medium text-gray-900">{item.value || "-"}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "name", label: "会社名" },
                { key: "email", label: "メール" },
                { key: "nameKana", label: "フリガナ" },
                { key: "invoiceNumber", label: "適格請求書番号" },
                { key: "postalCode", label: "郵便番号" },
                { key: "city", label: "市区町村" },
                { key: "streetAddress", label: "番地以下" },
                { key: "telNumber", label: "電話番号" },
                { key: "hpUrl", label: "HP URL" },
              ].map((item) => (
                <div key={item.key}>
                  <label className="mb-1 block text-[12px] font-medium text-gray-400">{item.label}</label>
                  <input
                    value={formData[item.key] ?? ""}
                    onChange={(e) => setFormData({ ...formData, [item.key]: e.target.value })}
                    className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-2.5 text-[14px] focus:ring-2 focus:ring-knock-blue/20 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
