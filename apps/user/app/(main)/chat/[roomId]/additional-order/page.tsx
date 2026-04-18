"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getChatRoom } from "@/lib/actions/chat";
import { getUnits } from "@/lib/actions/sites";
import { createAdditionalOrder } from "@/lib/actions/orders";
import { formatCurrency } from "@knock/utils";
import { ConfirmDialog, useToast } from "@knock/ui";

type Unit = { id: string; name: string };
type Item = {
  name: string;
  quantity: number;
  unitId: string;
  priceUnit: number;
  specifications: string;
};

function emptyItem(): Item {
  return { name: "", quantity: 1, unitId: "", priceUnit: 0, specifications: "" };
}

export default function AdditionalOrderPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [factoryFloorId, setFactoryFloorId] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    Promise.all([
      getChatRoom(roomId),
      getUnits(),
    ]).then(([chatData, unitList]) => {
      setFactoryFloorId(chatData.room.factoryFloor?.id ?? null);
      setUnits(unitList);
    }).finally(() => setLoading(false));
  }, [roomId]);

  function updateItem(index: number, field: keyof Item, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function validate(): boolean {
    const newErrors: Record<number, string> = {};
    items.forEach((item, i) => {
      if (!item.name.trim()) newErrors[i] = "項目名を入力してください";
      else if (item.quantity <= 0) newErrors[i] = "数量を入力してください";
      else if (item.priceUnit <= 0) newErrors[i] = "単価を入力してください";
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const subtotal = items.reduce((sum, item) => sum + Math.ceil(item.quantity * item.priceUnit), 0);
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;

  async function handleSubmit() {
    if (!factoryFloorId) return;
    setSubmitting(true);
    try {
      const result = await createAdditionalOrder(
        factoryFloorId,
        items.map((item) => ({
          name: item.name.trim(),
          quantity: item.quantity,
          unitId: item.unitId || undefined,
          priceUnit: item.priceUnit,
          specifications: item.specifications.trim() || undefined,
        })),
      );
      if (!result.success) {
        setShowConfirm(false);
        toast(result.error ?? "エラーが発生しました");
        alert(result.error ?? "エラーが発生しました");
        setSubmitting(false);
        return;
      }
      setShowConfirm(false);
      toast("追加注文書を作成しました");
      setTimeout(() => {
        router.replace(`/chat/${roomId}`);
      }, 1000);
    } catch (e) {
      setShowConfirm(false);
      const msg = e instanceof Error ? e.message : "エラーが発生しました";
      toast(msg);
      alert(msg);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!factoryFloorId) {
    return <div className="p-4 text-center text-knock-text-muted">現場情報が見つかりません</div>;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F5F5F5]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[17px] font-bold tracking-wide text-knock-text">追加工事</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
        {/* Items */}
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-2xl bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-bold text-knock-text-secondary">#{index + 1}</span>
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(index)}
                  className="text-[12px] font-semibold text-red-500 active:opacity-70"
                >
                  削除
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {/* 項目名 */}
              <div>
                <label className="mb-1 block text-[12px] font-bold text-knock-text-secondary">項目名</label>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  placeholder="例: 追加塗装工事"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] text-knock-text placeholder:text-gray-400 outline-none focus:border-knock-orange"
                />
              </div>

              {/* 数量 + 単位 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-knock-text-secondary">数量</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={item.quantity || ""}
                    onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] text-knock-text outline-none focus:border-knock-orange"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-knock-text-secondary">単位</label>
                  <select
                    value={item.unitId}
                    onChange={(e) => updateItem(index, "unitId", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] text-knock-text outline-none focus:border-knock-orange"
                  >
                    <option value="">選択なし</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 単価 */}
              <div>
                <label className="mb-1 block text-[12px] font-bold text-knock-text-secondary">単価</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={item.priceUnit || ""}
                    onChange={(e) => updateItem(index, "priceUnit", Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-8 text-right text-[14px] text-knock-text outline-none focus:border-knock-orange"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-knock-text-secondary">円</span>
                </div>
              </div>

              {/* 仕様 */}
              <div>
                <label className="mb-1 block text-[12px] font-bold text-knock-text-secondary">仕様・備考</label>
                <input
                  type="text"
                  value={item.specifications}
                  onChange={(e) => updateItem(index, "specifications", e.target.value)}
                  placeholder="任意"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] text-knock-text placeholder:text-gray-400 outline-none focus:border-knock-orange"
                />
              </div>

              {/* 小計 */}
              <div className="flex justify-end border-t border-gray-100 pt-2">
                <span className="text-[13px] text-knock-text-secondary">小計: </span>
                <span className="ml-1 text-[14px] font-bold text-knock-text">
                  {formatCurrency(Math.ceil(item.quantity * item.priceUnit))}
                </span>
              </div>

              {/* エラー */}
              {errors[index] && (
                <p className="text-[12px] text-red-500">{errors[index]}</p>
              )}
            </div>
          </div>
        ))}

        {/* 行を追加 */}
        <button
          onClick={addItem}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 py-3 text-[14px] font-semibold text-knock-text-secondary transition-colors active:bg-gray-100"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          行を追加
        </button>

        {/* 合計 */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-1 text-[14px]">
            <div className="flex justify-between">
              <span className="text-knock-text-secondary">小計</span>
              <span className="text-knock-text">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-knock-text-secondary">消費税（10%）</span>
              <span className="text-knock-text">{formatCurrency(tax)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1">
              <span className="font-bold text-knock-text">合計金額（税込）</span>
              <span className="font-bold" style={{ color: "#EA580C" }}>
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>

        {/* 送信ボタン */}
        <button
          onClick={() => {
            if (validate()) setShowConfirm(true);
          }}
          disabled={submitting}
          className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ backgroundColor: "#EA580C" }}
        >
          注文書を作成する
        </button>
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="追加注文書の作成確認"
        message={`合計 ${formatCurrency(total)} の追加注文書を作成しますか？作成後、受注者にも通知されます。`}
        confirmLabel={submitting ? "処理中..." : "作成する"}
        cancelLabel="キャンセル"
        variant="primary"
      />
    </div>
  );
}
