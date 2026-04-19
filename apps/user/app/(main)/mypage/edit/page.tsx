"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getProfile,
  updateProfile,
  changePassword,
  updateAvatar,
  getQualificationMasters,
  saveUserQualifications,
} from "@/lib/actions/profile";
import { useMode } from "@/lib/hooks/use-mode";
import QualificationSelector from "@/components/qualification-selector";

/* ──────────── Wavy Underline SVG ──────────── */

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

const inputCls =
  "w-full rounded-xl bg-[#F0F0F0] px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-knock-orange/30";

export default function EditProfilePage() {
  const router = useRouter();
  const { accentColor } = useMode();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [pwSection, setPwSection] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [formData, setFormData] = useState({
    lastName: "",
    firstName: "",
    lastNameKana: "",
    firstNameKana: "",
    email: "",
    telNumber: "",
    dateOfBirth: "",
    gender: "" as string,
    workEligibility: "" as string,
    tradeName: "",
    workersCompInsurance: "" as string,
  });

  // Qualification state
  const [qualMasters, setQualMasters] = useState<
    { id: string; name: string; category: string | null }[]
  >([]);
  const [selectedQualIds, setSelectedQualIds] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([getProfile(), getQualificationMasters()])
      .then(([profile, masters]) => {
        if (profile) {
          setFormData({
            lastName: profile.lastName ?? "",
            firstName: profile.firstName ?? "",
            lastNameKana: profile.lastNameKana ?? "",
            firstNameKana: profile.firstNameKana ?? "",
            email: profile.email ?? "",
            telNumber: profile.telNumber ?? "",
            dateOfBirth: profile.dateOfBirth ?? "",
            gender: profile.gender ?? "",
            workEligibility: profile.workEligibility ?? "",
            tradeName: profile.tradeName ?? "",
            workersCompInsurance:
              profile.workersCompInsurance === true
                ? "true"
                : profile.workersCompInsurance === false
                ? "false"
                : "",
          });
          setAvatarPreview(profile.avatar ?? null);
          setSelectedQualIds(
            profile.qualifications?.map((q) => q.qualification.id) ?? []
          );
        }
        setQualMasters(masters);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[EditProfile] load error:", err);
        setError("プロフィールの取得に失敗しました");
        setLoading(false);
      });
  }, []);

  function set(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await Promise.all([
        updateProfile({
          lastName: formData.lastName,
          firstName: formData.firstName,
          lastNameKana: formData.lastNameKana || undefined,
          firstNameKana: formData.firstNameKana || undefined,
          email: formData.email || undefined,
          telNumber: formData.telNumber || undefined,
          dateOfBirth: formData.dateOfBirth || undefined,
          gender: (formData.gender as "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED") || null,
          workEligibility:
            (formData.workEligibility as
              | "JAPANESE_NATIONAL"
              | "PERMANENT_RESIDENT"
              | "SPECIFIED_SKILLED"
              | "WORK_VISA"
              | "OTHER") || null,
          tradeName: formData.tradeName || null,
          workersCompInsurance:
            formData.workersCompInsurance === "true"
              ? true
              : formData.workersCompInsurance === "false"
              ? false
              : null,
        }),
        saveUserQualifications(selectedQualIds),
      ]);
      setSuccess("保存しました");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("新しいパスワードが一致しません");
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError("新しいパスワードは6文字以上で入力してください");
      return;
    }

    setPwSaving(true);
    try {
      await changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSuccess("パスワードを変更しました");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPwSuccess(""), 3000);
    } catch (err) {
      setPwError(
        err instanceof Error ? err.message : "パスワードの変更に失敗しました"
      );
    } finally {
      setPwSaving(false);
    }
  }

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 5MB制限
    if (file.size > 5 * 1024 * 1024) {
      setError("画像は5MB以下にしてください");
      return;
    }

    // 画像ファイルのみ
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }

    // リサイズしてBase64に変換
    const dataUrl = await resizeImage(file, 256);
    setAvatarPreview(dataUrl);
    setAvatarSaving(true);
    setError("");

    try {
      await updateAvatar(dataUrl);
    } catch (err) {
      console.error("[EditProfile] avatar error:", err);
      setError("画像の保存に失敗しました");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarSaving(true);
    try {
      await updateAvatar(null);
      setAvatarPreview(null);
    } catch (err) {
      console.error("[EditProfile] avatar remove error:", err);
      setError("画像の削除に失敗しました");
    } finally {
      setAvatarSaving(false);
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
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M13 4L7 10L13 16"
                stroke="#1A1A1A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">プロフィール編集</h1>
            <WavyUnderline color={accentColor} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-600">
            {success}
          </div>
        )}

        {/* Avatar Section */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-gray-500">
            プロフィール写真
          </h3>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={avatarSaving}
              className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-knock-orange/10 transition-opacity active:opacity-70 disabled:opacity-50"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="プロフィール写真"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[24px] font-bold text-knock-orange">
                  {formData.lastName?.charAt(0) || "?"}
                </span>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/20">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-0 transition-opacity hover:opacity-100"
                  style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={avatarSaving}
                className="rounded-lg bg-gray-100 px-3 py-2 text-[12px] font-medium text-gray-700 active:bg-gray-200 disabled:opacity-50"
              >
                {avatarSaving ? "アップロード中..." : "写真を変更"}
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={avatarSaving}
                  className="text-[12px] text-red-500 hover:underline disabled:opacity-50"
                >
                  写真を削除
                </button>
              )}
              <p className="text-[11px] text-gray-400">
                JPEG, PNG（5MB以下）
              </p>
            </div>
          </div>
        </div>

        {/* Basic Info Form */}
        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-gray-500">
              基本情報
            </h3>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                    姓 <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={formData.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                    名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={formData.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                    姓（カナ）
                  </label>
                  <input
                    value={formData.lastNameKana}
                    onChange={(e) => set("lastNameKana", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                    名（カナ）
                  </label>
                  <input
                    value={formData.firstNameKana}
                    onChange={(e) => set("firstNameKana", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  メールアドレス
                </label>
                <input
                  value={formData.email}
                  onChange={(e) => set("email", e.target.value)}
                  type="email"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  電話番号
                </label>
                <input
                  value={formData.telNumber}
                  onChange={(e) => set("telNumber", e.target.value)}
                  type="tel"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  生年月日
                </label>
                <input
                  value={formData.dateOfBirth}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                  type="date"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  性別
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => set("gender", e.target.value)}
                  className={inputCls}
                >
                  <option value="">未選択</option>
                  <option value="MALE">男性</option>
                  <option value="FEMALE">女性</option>
                  <option value="OTHER">その他</option>
                  <option value="UNSPECIFIED">未回答</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  就労資格
                </label>
                <select
                  value={formData.workEligibility}
                  onChange={(e) => set("workEligibility", e.target.value)}
                  className={inputCls}
                >
                  <option value="">未選択</option>
                  <option value="JAPANESE_NATIONAL">日本国籍</option>
                  <option value="PERMANENT_RESIDENT">外国籍（永住者・定住者等）</option>
                  <option value="SPECIFIED_SKILLED">外国籍（特定技能・建設分野）</option>
                  <option value="WORK_VISA">外国籍（技人国ビザ・高度専門職）</option>
                  <option value="OTHER">上記に該当しない</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  屋号
                </label>
                <input
                  value={formData.tradeName}
                  onChange={(e) => set("tradeName", e.target.value)}
                  placeholder="例: ○○建設"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  保有資格
                </label>
                <QualificationSelector
                  masters={qualMasters}
                  value={selectedQualIds}
                  onChange={setSelectedQualIds}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  労災保険
                </label>
                <select
                  value={formData.workersCompInsurance}
                  onChange={(e) => set("workersCompInsurance", e.target.value)}
                  className={inputCls}
                >
                  <option value="">未選択</option>
                  <option value="true">加入している</option>
                  <option value="false">加入していない</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-knock-orange py-3.5 text-[15px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "保存中..." : "基本情報を保存"}
          </button>
        </form>

        {/* Password Change Section */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={() => setPwSection(!pwSection)}
            className="flex w-full items-center justify-between"
          >
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-500">
              パスワード変更
            </h3>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className={`transition-transform ${pwSection ? "rotate-180" : ""}`}
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="#999"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {pwSection && (
            <form onSubmit={handlePasswordChange} className="mt-4">
              {pwError && (
                <div className="mb-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-600">
                  {pwSuccess}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                    現在のパスワード
                  </label>
                  <input
                    type="password"
                    value={pwForm.currentPassword}
                    onChange={(e) =>
                      setPwForm({ ...pwForm, currentPassword: e.target.value })
                    }
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                    新しいパスワード
                  </label>
                  <input
                    type="password"
                    value={pwForm.newPassword}
                    onChange={(e) =>
                      setPwForm({ ...pwForm, newPassword: e.target.value })
                    }
                    required
                    minLength={6}
                    className={inputCls}
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    6文字以上
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                    新しいパスワード（確認）
                  </label>
                  <input
                    type="password"
                    value={pwForm.confirmPassword}
                    onChange={(e) =>
                      setPwForm({ ...pwForm, confirmPassword: e.target.value })
                    }
                    required
                    minLength={6}
                    className={inputCls}
                  />
                </div>
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="rounded-lg border border-knock-orange px-4 py-2.5 text-[13px] font-bold text-knock-orange transition-colors active:bg-knock-orange/5 disabled:opacity-50"
                >
                  {pwSaving ? "変更中..." : "パスワードを変更"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image resize utility
// ---------------------------------------------------------------------------

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;

        // 正方形にクロップ（中央）
        const size = Math.min(w, h);
        const sx = (w - size) / 2;
        const sy = (h - size) / 2;

        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);

        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
