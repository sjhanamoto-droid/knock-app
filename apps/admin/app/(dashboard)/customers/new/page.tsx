"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCompany } from "@/lib/actions/customers";

const inputCls =
  "w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:ring-2 focus:ring-knock-blue/20 focus:outline-none";
const selectCls =
  "w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px] focus:ring-2 focus:ring-knock-blue/20 focus:outline-none appearance-none";
const labelCls = "mb-1.5 block text-[13px] font-semibold text-gray-600";

export default function NewCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    try {
      await createCompany({
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        type: fd.get("type") as "ORDERER" | "CONTRACTOR" | "BOTH",
        companyForm: fd.get("companyForm") as "CORPORATION" | "INDIVIDUAL",
        nameKana: (fd.get("nameKana") as string) || undefined,
        postalCode: (fd.get("postalCode") as string) || undefined,
        city: (fd.get("city") as string) || undefined,
        streetAddress: (fd.get("streetAddress") as string) || undefined,
        telNumber: (fd.get("telNumber") as string) || undefined,
      });
      router.push("/customers");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[24px] font-bold text-gray-900">企業を追加</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</div>
        )}

        <div className="rounded-2xl border-none bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.06)] space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>企業名 <span className="text-red-500">*</span></label>
              <input name="name" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>フリガナ</label>
              <input name="nameKana" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>メールアドレス <span className="text-red-500">*</span></label>
            <input name="email" type="email" required className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>企業種別 <span className="text-red-500">*</span></label>
              <select name="type" required className={selectCls}>
                <option value="ORDERER">発注者</option>
                <option value="CONTRACTOR">施工者</option>
                <option value="BOTH">両方</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>法人形態 <span className="text-red-500">*</span></label>
              <select name="companyForm" required className={selectCls}>
                <option value="CORPORATION">法人</option>
                <option value="INDIVIDUAL">個人事業主</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>電話番号</label>
            <input name="telNumber" className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>郵便番号</label>
              <input name="postalCode" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>市区町村</label>
              <input name="city" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>番地以下</label>
            <input name="streetAddress" className={inputCls} />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-knock-orange px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-knock-amber transition-colors disabled:opacity-50"
          >
            {loading ? "追加中..." : "企業を追加"}
          </button>
        </div>
      </form>
    </div>
  );
}
