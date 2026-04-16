"use client";

import { useState, useEffect } from "react";
import { getContractMasters, createContractMaster, deleteContractMaster } from "@/lib/actions/settings";
import { formatCurrency } from "@knock/utils";

type ContractMaster = Awaited<ReturnType<typeof getContractMasters>>[number];

const inputCls =
  "w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:ring-2 focus:ring-knock-blue/20 focus:outline-none";

export default function PlansPage() {
  const [plans, setPlans] = useState<ContractMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getContractMasters()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    try {
      await createContractMaster({
        name: fd.get("name") as string,
        type: Number(fd.get("type")),
        form: fd.get("form") as string,
        numberOfAccount: Number(fd.get("numberOfAccount")),
        price: Number(fd.get("price")),
        note: (fd.get("note") as string) || undefined,
      });
      const updated = await getContractMasters();
      setPlans(updated);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このプランを削除しますか？")) return;
    await deleteContractMaster(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
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
          <h1 className="text-[24px] font-bold text-gray-900">契約プラン</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-knock-amber transition-colors"
        >
          {showForm ? "閉じる" : "+ プラン追加"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">プラン名 *</label>
              <input name="name" required className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">種別 *</label>
              <select name="type" required className={inputCls + " appearance-none"}>
                <option value="1">基本</option>
                <option value="2">追加</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">契約形態 *</label>
              <input name="form" required className={inputCls} placeholder="例: 月額" />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">アカウント数 *</label>
              <input name="numberOfAccount" type="number" min="1" required className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">月額料金 *</label>
              <input name="price" type="number" min="0" required className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">備考</label>
              <input name="note" className={inputCls} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={formLoading} className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-knock-amber transition-colors disabled:opacity-50">
              {formLoading ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      )}

      {/* Plans Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-[13px] text-gray-400">読み込み中...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[13px] text-gray-400">プランがありません</div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <div className="flex items-start justify-between">
                <h3 className="text-[16px] font-bold text-gray-900">{plan.name}</h3>
                <button onClick={() => handleDelete(plan.id)} className="text-[12px] text-red-400 hover:text-red-600">削除</button>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-[13px]"><span className="text-gray-500">種別</span><span className="text-gray-900">{plan.type === 1 ? "基本" : "追加"}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-gray-500">形態</span><span className="text-gray-900">{plan.form}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-gray-500">アカウント数</span><span className="text-gray-900">{plan.numberOfAccount}</span></div>
                <div className="flex justify-between text-[13px]"><span className="text-gray-500">月額</span><span className="text-[15px] font-bold text-gray-900">{formatCurrency(plan.price)}</span></div>
              </div>
              {plan.note && <p className="mt-2 text-[12px] text-gray-500">{plan.note}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
