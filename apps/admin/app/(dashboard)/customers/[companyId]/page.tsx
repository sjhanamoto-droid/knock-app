"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCompany,
  updateCompany,
  deleteCompany,
  updateUser,
  resetUserPassword,
  getOccupationMasters,
  saveCompanyOccupations,
} from "@/lib/actions/customers";
import OccupationSelector from "@/components/occupation-selector";
import {
  companyTypeLabels,
  userRoleLabels,
  contractStatusLabels,
  paymentStatusLabels,
} from "@knock/utils";
import { formatDate, formatCurrency } from "@knock/utils";

type CompanyDetail = NonNullable<Awaited<ReturnType<typeof getCompany>>>;
type UserItem = CompanyDetail["users"][number];
type MajorItem = Awaited<ReturnType<typeof getOccupationMasters>>[number];
type OccSelection = { occupationSubItemId: string; note?: string };

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

const inputCls =
  "w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-knock-blue/20 focus:outline-none";
const selectCls = inputCls + " appearance-none";
const labelCls = "block text-[12px] font-semibold text-gray-500 mb-1.5";

function Field({
  label,
  children,
  span2,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    getCompany(params.companyId as string)
      .then(setCompany)
      .catch((err) => console.error("[CompanyDetail] fetch error:", err))
      .finally(() => setLoading(false));
  }, [params.companyId]);

  async function handleDelete() {
    if (!confirm("この企業を削除しますか？")) return;
    await deleteCompany(params.companyId as string);
    router.push("/customers");
    router.refresh();
  }

  async function toggleActive() {
    if (!company) return;
    const updated = await updateCompany(params.companyId as string, {
      isActive: !company.isActive,
    });
    setCompany({ ...company, isActive: updated.isActive });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="py-20 text-center text-gray-400">
        企業が見つかりません
      </div>
    );
  }

  const tabs = [
    { value: "info", label: "基本情報" },
    { value: "users", label: `ユーザー (${company.users.length})` },
    { value: "contracts", label: `契約 (${company.contracts.length})` },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="mb-2 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            顧客一覧に戻る
          </button>
          <h1 className="text-[24px] font-bold text-gray-900">
            {company.name || "(未設定)"}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${company.type === "ORDERER" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}
            >
              {companyTypeLabels[company.type]}
            </span>
            <span
              className={`text-[12px] font-medium ${company.isActive ? "text-emerald-600" : "text-red-500"}`}
            >
              {company.isActive ? "有効" : "無効"}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleActive}
            className="rounded-xl border border-gray-200 px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
          >
            {company.isActive ? "無効化" : "有効化"}
          </button>
          <button
            onClick={handleDelete}
            className="rounded-xl border border-red-200 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50"
          >
            削除
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`relative px-5 py-3 text-[14px] font-semibold ${activeTab === tab.value ? "text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
          >
            {tab.label}
            {activeTab === tab.value && (
              <span className="absolute bottom-0 left-0 h-[2.5px] w-full rounded-full bg-knock-orange" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-5">
        {activeTab === "info" && (
          <InfoTab
            company={company}
            onSaved={(updated) =>
              setCompany({ ...company, ...updated })
            }
            onOccupationsUpdated={(occs) =>
              setCompany({ ...company, occupations: occs })
            }
          />
        )}

        {activeTab === "users" && (
          <UsersTab
            users={company.users}
            onUserUpdated={(updated) =>
              setCompany({
                ...company,
                users: company.users.map((u: UserItem) =>
                  u.id === updated.id ? updated : u
                ),
              })
            }
          />
        )}

        {activeTab === "contracts" && (
          <div className="overflow-hidden rounded-2xl border-none bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                    プラン名
                  </th>
                  <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                    契約状態
                  </th>
                  <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                    支払状態
                  </th>
                  <th className="px-4 py-3 text-[12px] font-semibold text-gray-400">
                    金額
                  </th>
                </tr>
              </thead>
              <tbody>
                {company.contracts.map((contract) => (
                  <tr
                    key={contract.id}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-900">
                      {contract.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        {contractStatusLabels[contract.contractStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[12px] font-medium ${contract.paymentStatus === "PAID" ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {paymentStatusLabels[contract.paymentStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-600">
                      {contract.totalAmount
                        ? formatCurrency(contract.totalAmount)
                        : "-"}
                    </td>
                  </tr>
                ))}
                {company.contracts.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-[13px] text-gray-400"
                    >
                      契約がありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info Tab (company details - editable)
// ---------------------------------------------------------------------------

function InfoTab({
  company,
  onSaved,
  onOccupationsUpdated,
}: {
  company: CompanyDetail;
  onSaved: (data: Partial<CompanyDetail>) => void;
  onOccupationsUpdated: (occs: CompanyDetail["occupations"]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [occEditing, setOccEditing] = useState(false);
  const [occSaving, setOccSaving] = useState(false);
  const [occSaved, setOccSaved] = useState(false);
  const [masters, setMasters] = useState<MajorItem[]>([]);
  const [occSelections, setOccSelections] = useState<OccSelection[]>([]);
  const [form, setForm] = useState({
    name: company.name ?? "",
    nameKana: company.nameKana ?? "",
    email: company.email ?? "",
    type: company.type,
    companyForm: company.companyForm ?? "",
    postalCode: company.postalCode ?? "",
    prefecture: company.prefecture ?? "",
    city: company.city ?? "",
    streetAddress: company.streetAddress ?? "",
    building: company.building ?? "",
    telNumber: company.telNumber ?? "",
    hpUrl: company.hpUrl ?? "",
    invoiceNumber: company.invoiceNumber ?? "",
  });

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateCompany(company.id, {
        name: form.name || undefined,
        nameKana: form.nameKana || undefined,
        email: form.email || undefined,
        type: form.type as "ORDERER" | "CONTRACTOR" | "BOTH",
        companyForm: (form.companyForm || undefined) as
          | "CORPORATION"
          | "INDIVIDUAL"
          | undefined,
        postalCode: form.postalCode || undefined,
        prefecture: form.prefecture || undefined,
        city: form.city || undefined,
        streetAddress: form.streetAddress || undefined,
        building: form.building || undefined,
        telNumber: form.telNumber || undefined,
        hpUrl: form.hpUrl || undefined,
        invoiceNumber: form.invoiceNumber || undefined,
      });
      onSaved({
        name: form.name || null,
        nameKana: form.nameKana || null,
        email: form.email || null,
        type: form.type as CompanyDetail["type"],
        companyForm: (form.companyForm || null) as CompanyDetail["companyForm"],
        postalCode: form.postalCode || null,
        prefecture: form.prefecture || null,
        city: form.city || null,
        streetAddress: form.streetAddress || null,
        building: form.building || null,
        telNumber: form.telNumber || null,
        hpUrl: form.hpUrl || null,
        invoiceNumber: form.invoiceNumber || null,
      });
      setEditing(false);
    } catch (err) {
      console.error("[InfoTab] save error:", err);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  // Group occupations by major item for display
  const occByMajor = company.occupations.reduce<
    Record<string, { subItemName: string; note: string | null }[]>
  >((acc, occ) => {
    if (!acc[occ.majorItemName]) acc[occ.majorItemName] = [];
    acc[occ.majorItemName].push({
      subItemName: occ.subItemName,
      note: occ.note,
    });
    return acc;
  }, {});

  function startOccEditing() {
    setOccEditing(true);
    setOccSelections(
      company.occupations.map((o) => ({
        occupationSubItemId: o.occupationSubItemId,
        note: o.note ?? undefined,
      }))
    );
    if (masters.length === 0) {
      getOccupationMasters().then(setMasters);
    }
  }

  async function handleSaveOccupations() {
    setOccSaving(true);
    setOccSaved(false);
    try {
      await saveCompanyOccupations(company.id, occSelections);
      // Refetch to get updated display data with names
      const updated = await getCompany(company.id);
      if (updated) {
        onOccupationsUpdated(updated.occupations);
      }
      setOccEditing(false);
      setOccSaved(true);
      setTimeout(() => setOccSaved(false), 3000);
    } catch (err) {
      console.error("[InfoTab] save occupations error:", err);
      alert("職種の保存に失敗しました");
    } finally {
      setOccSaving(false);
    }
  }

  if (!editing) {
    const companyFormLabel =
      company.companyForm === "CORPORATION"
        ? "法人"
        : company.companyForm === "INDIVIDUAL"
          ? "個人事業主"
          : "-";
    const addressParts = [
      company.prefecture,
      company.city,
      company.streetAddress,
      company.building,
    ].filter(Boolean);

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-gray-900">会社情報</h3>
            <button
              onClick={() => setEditing(true)}
              className="rounded-xl bg-knock-orange px-5 py-2 text-[12px] font-bold text-white hover:bg-knock-amber"
            >
              編集
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "企業名", value: company.name },
              { label: "フリガナ", value: company.nameKana },
              { label: "メール", value: company.email },
              { label: "種別", value: companyTypeLabels[company.type] },
              { label: "法人形態", value: companyFormLabel },
              { label: "電話", value: company.telNumber },
              { label: "郵便番号", value: company.postalCode },
              {
                label: "住所",
                value: addressParts.length > 0 ? addressParts.join(" ") : null,
              },
              { label: "HP URL", value: company.hpUrl },
              { label: "インボイス番号", value: company.invoiceNumber },
              {
                label: "登録日",
                value: formatDate(new Date(company.createdAt)),
              },
            ].map((item) => (
              <div key={item.label}>
                <span className="text-[12px] font-medium text-gray-400">{item.label}</span>
                <p className="mt-0.5 text-[14px] font-medium text-gray-900">
                  {item.value || "-"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Occupation section */}
        <div className="rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-gray-900">
              対応職種
              {company.occupations.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-gray-500">
                  {company.occupations.length}件
                </span>
              )}
            </h3>
            {!occEditing && (
              <button
                onClick={startOccEditing}
                className="rounded-xl bg-knock-orange px-5 py-2 text-[12px] font-bold text-white hover:bg-knock-amber"
              >
                編集
              </button>
            )}
          </div>

          {occEditing ? (
            <div>
              <OccupationSelector
                masters={masters}
                value={occSelections}
                onChange={setOccSelections}
              />
              {occSelections.length > 0 && (
                <p className="mt-2 text-[12px] text-gray-500">
                  {occSelections.length}件選択中
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setOccEditing(false)}
                  disabled={occSaving}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveOccupations}
                  disabled={occSaving}
                  className="rounded-xl bg-knock-orange px-6 py-2.5 text-[13px] font-bold text-white hover:bg-knock-amber disabled:opacity-50"
                >
                  {occSaving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          ) : company.occupations.length === 0 ? (
            <p className="text-[13px] text-gray-400">未設定</p>
          ) : (
            <div className="flex flex-col gap-3">
              {Object.entries(occByMajor).map(([majorName, items]) => (
                <div key={majorName}>
                  <span className="text-[12px] font-bold text-gray-500">
                    {majorName}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {items.map((item) => (
                      <span
                        key={item.subItemName}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1.5 text-[12px] font-medium text-gray-700"
                      >
                        {item.subItemName}
                        {item.note && (
                          <span className="text-[11px] text-gray-400">
                            ({item.note})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {occSaved && !occEditing && (
            <p className="mt-2 text-[12px] font-medium text-emerald-600">
              保存しました
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <h3 className="mb-4 text-[15px] font-bold text-gray-900">
        会社情報を編集
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="企業名">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="フリガナ">
          <input
            className={inputCls}
            value={form.nameKana}
            onChange={(e) => set("nameKana", e.target.value)}
          />
        </Field>
        <Field label="メール">
          <input
            type="email"
            className={inputCls}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="種別">
          <select
            className={selectCls}
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          >
            <option value="ORDERER">発注者</option>
            <option value="CONTRACTOR">受注者</option>
            <option value="BOTH">発注者・受注者</option>
          </select>
        </Field>
        <Field label="法人形態">
          <select
            className={selectCls}
            value={form.companyForm}
            onChange={(e) => set("companyForm", e.target.value)}
          >
            <option value="">未設定</option>
            <option value="CORPORATION">法人</option>
            <option value="INDIVIDUAL">個人事業主</option>
          </select>
        </Field>
        <Field label="電話">
          <input
            className={inputCls}
            value={form.telNumber}
            onChange={(e) => set("telNumber", e.target.value)}
          />
        </Field>
        <Field label="郵便番号">
          <input
            className={inputCls}
            value={form.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
          />
        </Field>
        <Field label="都道府県">
          <input
            className={inputCls}
            value={form.prefecture}
            onChange={(e) => set("prefecture", e.target.value)}
          />
        </Field>
        <Field label="市区町村">
          <input
            className={inputCls}
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>
        <Field label="番地">
          <input
            className={inputCls}
            value={form.streetAddress}
            onChange={(e) => set("streetAddress", e.target.value)}
          />
        </Field>
        <Field label="建物名">
          <input
            className={inputCls}
            value={form.building}
            onChange={(e) => set("building", e.target.value)}
          />
        </Field>
        <Field label="HP URL">
          <input
            className={inputCls}
            value={form.hpUrl}
            onChange={(e) => set("hpUrl", e.target.value)}
          />
        </Field>
        <Field label="インボイス番号" span2>
          <input
            className={inputCls}
            value={form.invoiceNumber}
            onChange={(e) => set("invoiceNumber", e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={() => setEditing(false)}
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

// ---------------------------------------------------------------------------
// Users Tab (editable with password reset)
// ---------------------------------------------------------------------------

function UsersTab({
  users,
  onUserUpdated,
}: {
  users: UserItem[];
  onUserUpdated: (user: UserItem) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border-none bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
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
            {users.map((user) => (
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
                    {userRoleLabels[user.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[12px] font-medium ${user.isActive ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {user.isActive ? "有効" : "無効"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() =>
                      setEditingId(editingId === user.id ? null : user.id)
                    }
                    className="text-[12px] font-medium text-knock-blue hover:underline"
                  >
                    {editingId === user.id ? "閉じる" : "編集"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[13px] text-gray-400"
                >
                  ユーザーがいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingId && (
        <UserEditForm
          user={users.find((u) => u.id === editingId)!}
          onSaved={(updated) => {
            onUserUpdated(updated);
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Edit Form
// ---------------------------------------------------------------------------

function UserEditForm({
  user,
  onSaved,
  onCancel,
}: {
  user: UserItem;
  onSaved: (user: UserItem) => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [form, setForm] = useState({
    lastName: user.lastName,
    firstName: user.firstName,
    lastNameKana: user.lastNameKana ?? "",
    firstNameKana: user.firstNameKana ?? "",
    email: user.email,
    telNumber: user.telNumber ?? "",
    dateOfBirth: user.dateOfBirth ?? "",
    role: user.role,
    isActive: user.isActive,
  });
  const [newPassword, setNewPassword] = useState("");

  function set(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateUser(user.id, {
        lastName: form.lastName,
        firstName: form.firstName,
        lastNameKana: form.lastNameKana || undefined,
        firstNameKana: form.firstNameKana || undefined,
        email: form.email,
        telNumber: form.telNumber || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        role: form.role as "REPRESENTATIVE" | "MANAGER" | "OTHER",
        isActive: form.isActive,
      });
      onSaved(updated as UserItem);
    } catch (err) {
      console.error("[UserEdit] save error:", err);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!newPassword || newPassword.length < 6) {
      alert("パスワードは6文字以上で入力してください");
      return;
    }
    if (!confirm("パスワードをリセットしますか？")) return;
    setPwSaving(true);
    try {
      await resetUserPassword(user.id, newPassword);
      setNewPassword("");
      setPwDone(true);
      setTimeout(() => setPwDone(false), 3000);
    } catch (err) {
      console.error("[UserEdit] password reset error:", err);
      alert("パスワードリセットに失敗しました");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <h3 className="mb-4 text-[15px] font-bold text-gray-900">
        ユーザー情報を編集: {user.lastName} {user.firstName}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <Field label="姓">
          <input
            className={inputCls}
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </Field>
        <Field label="名">
          <input
            className={inputCls}
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </Field>
        <Field label="姓（カナ）">
          <input
            className={inputCls}
            value={form.lastNameKana}
            onChange={(e) => set("lastNameKana", e.target.value)}
          />
        </Field>
        <Field label="名（カナ）">
          <input
            className={inputCls}
            value={form.firstNameKana}
            onChange={(e) => set("firstNameKana", e.target.value)}
          />
        </Field>
        <Field label="メール">
          <input
            type="email"
            className={inputCls}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="電話">
          <input
            className={inputCls}
            value={form.telNumber}
            onChange={(e) => set("telNumber", e.target.value)}
          />
        </Field>
        <Field label="生年月日">
          <input
            type="date"
            className={inputCls}
            value={form.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
          />
        </Field>
        <Field label="権限">
          <select
            className={selectCls}
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
          >
            <option value="REPRESENTATIVE">代表者</option>
            <option value="MANAGER">管理者</option>
            <option value="OTHER">一般</option>
          </select>
        </Field>
        <Field label="状態">
          <select
            className={selectCls}
            value={form.isActive ? "true" : "false"}
            onChange={(e) => set("isActive", e.target.value === "true")}
          >
            <option value="true">有効</option>
            <option value="false">無効</option>
          </select>
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
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

      {/* Password Reset */}
      <div className="mt-6 border-t border-gray-200 pt-5">
        <h4 className="mb-3 text-[13px] font-bold text-gray-900">
          パスワードリセット
        </h4>
        <p className="mb-3 text-[12px] text-gray-500">
          新しいパスワードを設定します。現在のパスワードはハッシュ化されており表示できません。
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={labelCls}>新しいパスワード</label>
            <input
              type="text"
              className={inputCls}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="6文字以上"
            />
          </div>
          <button
            onClick={handlePasswordReset}
            disabled={pwSaving || !newPassword}
            className="shrink-0 rounded-xl border border-red-200 px-5 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {pwSaving ? "リセット中..." : pwDone ? "完了 ✓" : "パスワードをリセット"}
          </button>
        </div>
      </div>
    </div>
  );
}
