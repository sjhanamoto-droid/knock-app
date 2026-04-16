"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getProfile, updateCompany } from "@/lib/actions/profile";
import { useMode } from "@/lib/hooks/use-mode";
import { companyTypeLabels } from "@knock/utils";
import { SideMenu } from "@/components/side-menu";
import {
  getOccupationMasters,
  getCompanyOccupations,
  saveCompanyOccupations,
} from "@/lib/actions/occupations";
import OccupationSelector from "@/components/occupation-selector";

type Profile = Awaited<ReturnType<typeof getProfile>>;
type MajorItem = Awaited<ReturnType<typeof getOccupationMasters>>[number];
type Selection = { occupationSubItemId: string; note?: string };

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] focus:border-knock-blue focus:outline-none focus:ring-1 focus:ring-knock-blue";

/* ──────────── Icons ──────────── */

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M3 6H19M3 11H19M3 16H19" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 2C7.686 2 5 4.686 5 8V12L3 15H19L17 12V8C17 4.686 14.314 2 11 2Z" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 18C9 19.105 9.895 20 11 20C12.105 20 13 19.105 13 18" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M6 2L5 4H2C1.45 4 1 4.45 1 5V13C1 13.55 1.45 14 2 14H14C14.55 14 15 13.55 15 13V5C15 4.45 14.55 4 14 4H11L10 2H6Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect width="18" height="18" rx="4" fill="#3B82F6" />
      <path d="M5 13L6.5 13L11.5 8L10 6.5L5 11.5V13Z" fill="white" />
      <path d="M12.5 5.5L13.5 6.5L12 8L11 7L12.5 5.5Z" fill="white" />
    </svg>
  );
}

/* ──────────── Field Row ──────────── */

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 py-3.5 border-b border-gray-100 last:border-b-0">
      <span className="text-[12px] font-bold text-knock-text">{label}</span>
      <span className="text-[14px] text-knock-text-secondary">{value || "-"}</span>
    </div>
  );
}

/* ──────────── Main Page ──────────── */

export default function CompanyInfoPage() {
  const router = useRouter();
  const { accentColor } = useMode();

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"personal" | "company">("company");
  const [profile, setProfile] = useState<Profile>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit mode state
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    nameKana: "",
    email: "",
    telNumber: "",
    postalCode: "",
    prefecture: "",
    city: "",
    streetAddress: "",
    building: "",
    hpUrl: "",
    invoiceNumber: "",
  });

  // Stamp image state
  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const [uploadingStamp, setUploadingStamp] = useState(false);

  // Occupation state
  const [masters, setMasters] = useState<MajorItem[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [savingOcc, setSavingOcc] = useState(false);
  const [occSaved, setOccSaved] = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (!p?.company) {
          router.replace("/mypage");
          return;
        }
        if (p.role !== "REPRESENTATIVE" && p.role !== "MANAGER") {
          router.replace("/mypage");
          return;
        }
        setProfile(p);
        setStampPreview(p.company.stampImage ?? null);
        const c = p.company;
        setFormData({
          name: c.name ?? "",
          nameKana: c.nameKana ?? "",
          email: c.email ?? "",
          telNumber: c.telNumber ?? "",
          postalCode: c.postalCode ?? "",
          prefecture: c.prefecture ?? "",
          city: c.city ?? "",
          streetAddress: c.streetAddress ?? "",
          building: c.building ?? "",
          hpUrl: c.hpUrl ?? "",
          invoiceNumber: c.invoiceNumber ?? "",
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "プロフィールの取得に失敗しました");
        setLoading(false);
      });

    getOccupationMasters().then(setMasters);
    getCompanyOccupations().then((occs) => {
      setSelections(
        occs.map((o) => ({
          occupationSubItemId: o.occupationSubItemId,
          note: o.note ?? undefined,
        }))
      );
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      await updateCompany({
        name: formData.name || undefined,
        nameKana: formData.nameKana || undefined,
        email: formData.email || undefined,
        telNumber: formData.telNumber || undefined,
        postalCode: formData.postalCode || undefined,
        prefecture: formData.prefecture || undefined,
        city: formData.city || undefined,
        streetAddress: formData.streetAddress || undefined,
        building: formData.building || undefined,
        hpUrl: formData.hpUrl || undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
      });
      // Refresh profile after save
      const updated = await getProfile();
      if (updated) setProfile(updated);
      setEditOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  function set(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-[14px] text-red-600 text-center">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-700"
        >
          再読み込み
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const fullName = [profile.lastName, profile.firstName].filter(Boolean).join(" ");
  const company = profile.company!;
  const address = [
    company.postalCode ? `〒${company.postalCode}` : null,
    company.prefecture,
    company.city,
    company.streetAddress,
    company.building,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-50">
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={fullName || undefined}
        companyName={company.name || undefined}
      />

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <MenuIcon />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-[17px] font-bold text-knock-text">マイページ</h1>
            <div className="mt-0.5 h-[3px] w-10 rounded-full bg-knock-orange" />
          </div>
          <Link
            href="/notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <BellIcon />
          </Link>
        </div>
      </header>

      {/* ─── Cover Photo + Avatar ─── */}
      <div className="relative">
        {/* Cover photo */}
        <div className="h-[200px] w-full bg-gray-300 overflow-hidden">
          {company.logo ? (
            <img src={company.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-gray-400 to-gray-500" />
          )}
        </div>

        {/* Camera icon on cover photo - bottom right */}
        <button className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white">
          <CameraIcon size={16} />
        </button>

        {/* Avatar overlapping cover photo bottom-left */}
        <div className="absolute -bottom-10 left-4">
          <div className="relative">
            <div
              className="h-20 w-20 overflow-hidden rounded-full border-white shadow-md bg-gray-200"
              style={{ borderWidth: 3, borderStyle: "solid" }}
            >
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[24px] font-bold"
                  style={{ backgroundColor: `var(--mode-accent-bg)`, color: accentColor }}
                >
                  {profile.lastName?.charAt(0)}
                </div>
              )}
            </div>
            {/* Camera icon on avatar */}
            <button className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white">
              <CameraIcon size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* spacer for avatar overlap */}
      <div className="h-12" />

      {/* ─── Tab Bar ─── */}
      <div className="flex gap-2 px-4 py-3 bg-gray-50">
        <button
          onClick={() => {
            setActiveTab("personal");
            router.push("/mypage");
          }}
          className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
            activeTab === "personal"
              ? "bg-gray-800 text-white"
              : "bg-transparent text-gray-400"
          }`}
        >
          本人情報
        </button>
        <button
          onClick={() => setActiveTab("company")}
          className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
            activeTab === "company"
              ? "bg-gray-800 text-white"
              : "bg-transparent text-gray-400"
          }`}
        >
          会社情報
        </button>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="flex flex-col gap-3 px-4 pb-8">
        {/* ─── Company Info Card ─── */}
        <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          {/* Edit button top-right */}
          <div className="flex items-center justify-end px-4 pt-4">
            <button
              onClick={() => setEditOpen((v) => !v)}
              className="flex items-center justify-center"
            >
              <EditIcon />
            </button>
          </div>

          <div className="px-4 pb-4 pt-2">
            <FieldRow
              label="種別"
              value={companyTypeLabels[company.type] ?? company.type ?? null}
            />
            <FieldRow label="会社形態" value={company.type ?? null} />
            <FieldRow label="会社名称/屋号" value={company.name ?? null} />
            <FieldRow label="フリガナ" value={company.nameKana ?? null} />
            <FieldRow
              label="住所公開"
              value={address || null}
            />
            <FieldRow label="メールアドレス" value={company.email ?? null} />
            <FieldRow label="電話番号" value={company.telNumber ?? null} />
            <FieldRow label="HP URL" value={company.hpUrl ?? null} />
            <FieldRow label="適格請求書番号" value={company.invoiceNumber ?? null} />
            <div className="flex flex-col gap-0.5 py-3.5 border-b border-gray-100 last:border-b-0">
              <span className="text-[12px] font-bold text-knock-text">印鑑画像</span>
              {stampPreview ? (
                <img src={stampPreview} alt="印鑑" className="mt-1 h-16 w-16 rounded border border-gray-200 object-contain bg-white p-1" />
              ) : (
                <span className="text-[14px] text-knock-text-secondary">未登録</span>
              )}
            </div>
          </div>
        </div>

        {/* ─── Edit Form (expandable) ─── */}
        {editOpen && (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            {saveError && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
                {saveError}
              </div>
            )}

            {/* 基本情報 */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <h3 className="mb-3 text-[13px] font-bold text-knock-text-secondary">基本情報</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">企業名</label>
                  <input value={formData.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">フリガナ</label>
                  <input value={formData.nameKana} onChange={(e) => set("nameKana", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">メールアドレス</label>
                  <input value={formData.email} onChange={(e) => set("email", e.target.value)} type="email" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">電話番号</label>
                  <input value={formData.telNumber} onChange={(e) => set("telNumber", e.target.value)} type="tel" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">HP URL</label>
                  <input value={formData.hpUrl} onChange={(e) => set("hpUrl", e.target.value)} className={inputCls} placeholder="https://" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">適格請求書番号</label>
                  <input value={formData.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} className={inputCls} placeholder="T1234567890123" />
                </div>
              </div>
            </div>

            {/* 対応職種 */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-knock-text-secondary">対応職種</h3>
                {selections.length > 0 && (
                  <span className="text-[12px] text-knock-text-secondary">
                    {selections.length}件選択中
                  </span>
                )}
              </div>
              <OccupationSelector
                masters={masters}
                value={selections}
                onChange={setSelections}
              />
              <button
                type="button"
                onClick={async () => {
                  setSavingOcc(true);
                  setOccSaved(false);
                  try {
                    await saveCompanyOccupations(selections);
                    setOccSaved(true);
                    setTimeout(() => setOccSaved(false), 3000);
                  } catch (err) {
                    setSaveError(err instanceof Error ? err.message : "職種の保存に失敗しました");
                  } finally {
                    setSavingOcc(false);
                  }
                }}
                disabled={savingOcc}
                className="mt-3 w-full rounded-lg border border-knock-orange px-4 py-2.5 text-[13px] font-bold text-knock-orange transition-colors active:bg-knock-orange/5 disabled:opacity-50"
              >
                {savingOcc ? "保存中..." : occSaved ? "保存しました" : "職種を保存"}
              </button>
            </div>

            {/* 住所 */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <h3 className="mb-3 text-[13px] font-bold text-knock-text-secondary">住所</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">郵便番号</label>
                  <input value={formData.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputCls} placeholder="123-4567" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">都道府県</label>
                  <input value={formData.prefecture} onChange={(e) => set("prefecture", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">市区町村</label>
                  <input value={formData.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">番地</label>
                  <input value={formData.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">建物名</label>
                  <input value={formData.building} onChange={(e) => set("building", e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* 印鑑画像 */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <h3 className="mb-3 text-[13px] font-bold text-knock-text-secondary">印鑑画像</h3>
              <p className="mb-3 text-[12px] text-gray-500">帳票（注文書・納品書・請求書）に自動挿入されます</p>

              {stampPreview ? (
                <div className="flex items-center gap-4">
                  <img src={stampPreview} alt="印鑑" className="h-20 w-20 rounded border border-gray-200 object-contain bg-white p-1" />
                  <button
                    type="button"
                    onClick={async () => {
                      setUploadingStamp(true);
                      try {
                        await updateCompany({ stampImage: null });
                        setStampPreview(null);
                        const updated = await getProfile();
                        if (updated) setProfile(updated);
                      } catch (err) {
                        setSaveError(err instanceof Error ? err.message : "削除に失敗しました");
                      } finally {
                        setUploadingStamp(false);
                      }
                    }}
                    disabled={uploadingStamp}
                    className="rounded-lg border border-red-300 px-3 py-2 text-[13px] font-medium text-red-600 transition-colors active:bg-red-50 disabled:opacity-50"
                  >
                    削除
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-6 transition-colors hover:border-knock-orange">
                  <CameraIcon size={24} />
                  <span className="text-[13px] font-medium text-gray-500">
                    {uploadingStamp ? "アップロード中..." : "PNG / JPEG画像を選択"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    disabled={uploadingStamp}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        setSaveError("ファイルサイズは5MB以下にしてください");
                        return;
                      }
                      setUploadingStamp(true);
                      setSaveError("");
                      try {
                        const fd = new FormData();
                        fd.append("files", file);
                        const res = await fetch("/api/upload", { method: "POST", body: fd });
                        if (!res.ok) throw new Error("アップロードに失敗しました");
                        const { urls } = await res.json();
                        const url = urls[0] as string;
                        await updateCompany({ stampImage: url });
                        setStampPreview(url);
                        const updated = await getProfile();
                        if (updated) setProfile(updated);
                      } catch (err) {
                        setSaveError(err instanceof Error ? err.message : "アップロードに失敗しました");
                      } finally {
                        setUploadingStamp(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex-1 rounded-xl border border-gray-300 py-3.5 text-[15px] font-bold text-gray-600 transition-all active:scale-[0.98]"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-knock-orange py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? "保存中..." : "変更を保存"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
