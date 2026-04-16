"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getOrderDetail, submitInspection, approveDelivery, rejectInspection } from "@/lib/actions/orders";
import { getUnits } from "@/lib/actions/sites";
import { useToast, ConfirmDialog, AlertDialog } from "@knock/ui";

type Unit = { id: string; name: string };

type OrderDetail = Awaited<ReturnType<typeof getOrderDetail>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InspectionData = {
  additionalItems?: { name: string; quantity: number; unitId: string; priceUnit: number; specifications: string }[];
  expenses?: number;
  adjustmentAmount?: number;
  advancePayment?: number;
  memo?: string;
};

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

/* ──── Read-only field (gray bg) ──── */
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[12px] font-bold text-knock-text">{label}</p>
      <div className="rounded-lg bg-[#F0F0F0] px-3 py-2.5">
        <span className="text-[14px] text-knock-text-secondary">{value}</span>
      </div>
    </div>
  );
}

/* ──── Editable row with colored left border ──── */
function EditableRow({
  borderColor,
  name,
  amount,
  onAmountChange,
  nameReadOnly,
  amountPrefix,
  amountClassName,
}: {
  borderColor: string;
  name: string;
  amount: string;
  onAmountChange?: (v: string) => void;
  nameReadOnly?: boolean;
  amountPrefix?: string;
  amountClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white overflow-hidden"
      >
        <div className="w-1 self-stretch shrink-0" style={{ backgroundColor: borderColor }} />
        <span className={`flex-1 py-2.5 text-[13px] ${nameReadOnly ? "text-knock-text-secondary" : "text-knock-text"}`}>
          {name}
        </span>
      </div>
      <div className="w-[100px] shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-right">
        {onAmountChange ? (
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value.replace(/[^\d-]/g, ""))}
            placeholder="¥0"
            className={`w-full bg-transparent text-right text-[13px] outline-none ${amountClassName ?? "text-knock-text"}`}
          />
        ) : (
          <span className={`text-[13px] ${amountClassName ?? "text-knock-text"}`}>
            {amountPrefix}{amount}
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   受注者用: 発注者と完全に同じレイアウト（読み取り専用）
   ═══════════════════════════════════════════════════════ */
function ContractorView({
  order,
  accentColor,
  units,
}: {
  order: NonNullable<OrderDetail>;
  accentColor: string;
  units: Unit[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const floor = order.factoryFloor;

  // inspectionData から内訳を取得
  const inspection = (order.inspectionData as InspectionData | null) ?? {};
  const additionalItems = inspection.additionalItems ?? [];
  const expensesVal = inspection.expenses ?? 0;
  const adjustmentVal = inspection.adjustmentAmount ?? 0;
  const advanceVal = inspection.advancePayment ?? 0;
  const memoVal = inspection.memo ?? "";

  // 工事金額明細の小計（税抜）
  const priceDetailsSubtotal = floor.priceDetails.reduce(
    (sum, d) => sum + Math.ceil(d.quantity * Number(d.priceUnit)), 0
  );

  // 納品合計金額 (A) — 税込
  const totalAmount = Number(floor.totalAmount ?? 0) || Math.round(priceDetailsSubtotal * 1.1);
  const taxExclusive = Math.round(totalAmount / 1.1);
  const tax = totalAmount - taxExclusive;

  // 追加工事合計
  const additionalTotal = additionalItems.reduce(
    (sum, item) => sum + Math.ceil(item.quantity * item.priceUnit), 0
  );

  // 支払金額 = 注文金額 + 追加工事 + 諸経費 + 調整金額 - 前払金
  const paymentAmount = totalAmount + additionalTotal + expensesVal + adjustmentVal - advanceVal;

  // 単位名を取得するヘルパー
  function getUnitName(unitId: string): string {
    if (!unitId) return "-";
    const unit = units.find((u) => u.id === unitId);
    return unit?.name ?? "-";
  }

  async function handleApprove() {
    setSubmitting(true);
    try {
      await approveDelivery(order.id);
      setSuccessMessage("納品金額を承認しました");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    try {
      await rejectInspection(order.id);
      setSuccessMessage("発注者に差し戻しました");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  // 読み取り専用input共通クラス
  const roInput =
    "w-full rounded-lg border border-gray-200 bg-[#F0F0F0] px-3 py-2.5 text-[14px] text-knock-text-secondary outline-none cursor-default";

  return (
    <div className="flex flex-col bg-white min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="relative flex h-14 items-center justify-center px-4">
          <button
            onClick={() => router.back()}
            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[16px] font-bold text-knock-text">納品金額確認</span>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
        {/* 確認メッセージ */}
        <div className="rounded-xl bg-blue-50 p-3 text-center">
          <span className="text-[14px] font-bold text-knock-blue">
            納品金額の内容をご確認ください
          </span>
        </div>

        {/* 読み取り専用フィールド */}
        <ReadOnlyField
          label="注文No"
          value={floor.orderNumber ? String(floor.orderNumber).padStart(5, "0") : "—"}
        />
        <ReadOnlyField label="工事コード" value={floor.code ?? "—"} />
        <ReadOnlyField label="工事名" value={floor.name ?? "—"} />
        <ReadOnlyField label="納品合計金額（A）" value={formatYen(totalAmount)} />
        <ReadOnlyField label="うち消費税（B）" value={formatYen(tax)} />
        <ReadOnlyField label="工事金額(税抜)（A）−（B）" value={formatYen(taxExclusive)} />

        {/* 注文金額ボックス */}
        <div className="rounded-xl border border-gray-200 py-4 text-center">
          <p className="text-[12px] text-knock-text-secondary">注文金額</p>
          <p className="mt-1 text-[24px] font-bold text-knock-text">{formatYen(totalAmount)}</p>
        </div>

        {/* 工事金額明細（読み取り専用） */}
        {floor.priceDetails.length > 0 && (
          <div>
            <p className="mb-1 text-[13px] font-bold text-knock-text">工事金額明細</p>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] text-knock-text-secondary">名称</span>
              <span className="text-[11px] text-knock-text-secondary">納品金額（税抜）</span>
            </div>
            <div className="flex flex-col gap-2">
              {floor.priceDetails.map((detail) => (
                <EditableRow
                  key={detail.id}
                  borderColor="#F5A623"
                  name={detail.name}
                  amount={formatYen(Math.ceil(detail.quantity * Number(detail.priceUnit)))}
                  nameReadOnly
                />
              ))}
            </div>
          </div>
        )}

        {/* 追加の工事金額明細（発注者と同じカードレイアウト・読み取り専用） */}
        <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-bold text-knock-text">明細</p>
          </div>

          {additionalItems.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              追加の明細行がありません
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {additionalItems.map((item, i) => {
                const rowSubtotal = Math.ceil(item.quantity * item.priceUnit);
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-gray-200 bg-gray-50/50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-bold text-gray-500">#{i + 1}</span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {/* 項目名 */}
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">項目名</label>
                        <input type="text" value={item.name || ""} readOnly className={roInput} />
                      </div>

                      {/* 数量 + 単位 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-gray-500">数量</label>
                          <input type="text" value={String(item.quantity)} readOnly className={roInput} />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-gray-500">単位</label>
                          <input type="text" value={getUnitName(item.unitId)} readOnly className={roInput} />
                        </div>
                      </div>

                      {/* 単価 */}
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">単価</label>
                        <div className="relative">
                          <input type="text" value={String(item.priceUnit)} readOnly className={`${roInput} pr-8`} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">円</span>
                        </div>
                      </div>

                      {/* 仕様 */}
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">仕様</label>
                        <input type="text" value={item.specifications || ""} readOnly className={roInput} placeholder="仕様・備考" />
                      </div>

                      {/* 小計 */}
                      <div className="mt-1 text-right text-[13px] font-bold text-knock-text">
                        小計: {formatYen(rowSubtotal)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 合計 */}
              <div className="rounded-xl bg-knock-accent/5 px-4 py-3 text-right">
                <span className="text-[13px] text-gray-600">合計: </span>
                <span className="text-[16px] font-bold text-knock-accent">
                  {formatYen(additionalTotal)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 諸経費（税込） */}
        <div>
          <p className="mb-2 text-[13px] font-bold text-knock-text">諸経費（税込）</p>
          <EditableRow
            borderColor="#F5A623"
            name="諸経費"
            amount={expensesVal ? String(expensesVal) : ""}
            nameReadOnly
          />
        </div>

        {/* 調整金額（税込） */}
        <div>
          <p className="mb-2 text-[13px] font-bold text-knock-text">調整金額（税込）</p>
          <div className="flex flex-col gap-2">
            <EditableRow
              borderColor="#333333"
              name="調整金額"
              amount={adjustmentVal ? String(adjustmentVal) : ""}
              nameReadOnly
            />
            <EditableRow
              borderColor="#EF4444"
              name="前払金"
              amount={advanceVal ? String(advanceVal) : ""}
              nameReadOnly
              amountPrefix="▲"
              amountClassName="text-red-500 font-bold"
            />
          </div>
        </div>

        {/* 支払金額ボックス */}
        <div className="rounded-xl border-2 border-red-400 py-4 text-center">
          <p className="text-[12px] font-bold text-red-500">支払金額</p>
          <p className="mt-1 text-[24px] font-bold text-knock-text">{formatYen(paymentAmount)}</p>
        </div>

        {/* 備考 */}
        <div>
          <p className="mb-1 text-[13px] font-bold text-knock-text">
            備考
            <span className="ml-1 text-[11px] font-normal text-knock-text-secondary">
              （前払金の支払日などを記載すると納品書に反映されます）
            </span>
          </p>
          <textarea
            value={memoVal}
            readOnly
            className="w-full rounded-xl border border-gray-200 bg-[#F0F0F0] p-3 text-[14px] text-knock-text-secondary outline-none cursor-default"
            rows={4}
          />
        </div>

        {/* アクションボタン */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={() => setConfirmAction("approve")}
            disabled={submitting}
            className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? "処理中..." : "内容を承認する"}
          </button>
          <p className="text-center text-[11px] text-knock-text-secondary">
            承認すると納品書が自動生成されます
          </p>

          <button
            onClick={() => setConfirmAction("reject")}
            disabled={submitting}
            className="w-full rounded-xl border-2 py-3.5 text-[15px] font-bold transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ borderColor: accentColor, color: accentColor }}
          >
            差し戻す
          </button>
          <p className="text-center text-[11px] text-knock-text-secondary">
            金額に問題がある場合、発注者に差し戻します
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction === "approve"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleApprove}
        title="納品金額の承認"
        message="納品金額を承認しますか？承認すると納品書が自動生成されます。"
        confirmLabel={submitting ? "処理中..." : "はい"}
        cancelLabel="いいえ"
        variant="primary"
      />
      <ConfirmDialog
        open={confirmAction === "reject"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleReject}
        title="差し戻し"
        message="発注者に差し戻しますか？"
        confirmLabel={submitting ? "処理中..." : "はい"}
        cancelLabel="いいえ"
        variant="danger"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => router.replace(`/orders/${order.id}`)}
        title="完了"
        message={successMessage}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   メインコンポーネント: 発注者 = 編集 / 受注者 = 確認
   ═══════════════════════════════════════════════════════ */
export default function InspectionPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { accentColor, isOrderer } = useMode();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Units master
  const [units, setUnits] = useState<Unit[]>([]);

  // Editable state (orderer only)
  const [additionalItems, setAdditionalItems] = useState<{
    name: string;
    quantity: number;
    unitId: string;
    priceUnit: number;
    specifications: string;
  }[]>([]);
  const [expensesAmount, setExpensesAmount] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [advancePayment, setAdvancePayment] = useState("");
  const [memo, setMemo] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [ordererSuccess, setOrdererSuccess] = useState("");

  useEffect(() => {
    getUnits().then(setUnits).catch(() => {});
    getOrderDetail(orderId)
      .then((data) => {
        setOrder(data);
        if (data) {
          // inspectionDataが既にある場合は復元
          const inspection = (data.inspectionData as InspectionData | null);
          if (inspection) {
            if (inspection.additionalItems?.length) {
              setAdditionalItems(inspection.additionalItems);
            }
            if (inspection.expenses) setExpensesAmount(String(inspection.expenses));
            if (inspection.adjustmentAmount) setAdjustmentAmount(String(inspection.adjustmentAmount));
            if (inspection.advancePayment) setAdvancePayment(String(inspection.advancePayment));
            if (inspection.memo) setMemo(inspection.memo);
          } else {
            // 初回: 完了報告の追加工事を初期値に
            if (data.completionReport?.hasAdditionalWork && data.completionReport.additionalWorkAmount) {
              setAdditionalItems([{
                name: data.completionReport.additionalWorkDescription ?? "追加工事",
                quantity: 1,
                unitId: "",
                priceUnit: Number(data.completionReport.additionalWorkAmount),
                specifications: "",
              }]);
            }
            // 諸経費を初期値に
            if (data.factoryFloor.expenses) {
              setExpensesAmount(String(Number(data.factoryFloor.expenses)));
            }
            // 前払金を初期値に
            if (data.factoryFloor.totalAdvancePayment) {
              setAdvancePayment(String(Number(data.factoryFloor.totalAdvancePayment)));
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-4 text-center text-knock-text-muted">取引が見つかりません</div>;
  }

  // 受注者は確認画面を表示
  if (!isOrderer) {
    return <ContractorView order={order} accentColor={accentColor} units={units} />;
  }

  // ─── 以下、発注者用の編集画面 ───

  const floor = order.factoryFloor;

  // 工事金額明細の小計（税抜）
  const priceDetailsSubtotal = floor.priceDetails.reduce(
    (sum, d) => sum + Math.ceil(d.quantity * Number(d.priceUnit)), 0
  );

  // 納品合計金額 (A) — 税込
  const totalAmount = Number(floor.totalAmount ?? 0) || Math.round(priceDetailsSubtotal * 1.1);
  const taxExclusive = Math.round(totalAmount / 1.1);
  const tax = totalAmount - taxExclusive;

  // 追加工事合計
  const additionalTotal = additionalItems.reduce(
    (sum, item) => sum + Math.ceil(item.quantity * item.priceUnit), 0
  );

  // 諸経費
  const expenses = parseInt(expensesAmount) || 0;

  // 調整金額
  const adjustment = parseInt(adjustmentAmount) || 0;

  // 前払金
  const advance = parseInt(advancePayment) || 0;

  // 支払金額 = 注文金額 + 追加工事 + 諸経費 + 調整金額 - 前払金
  const paymentAmount = totalAmount + additionalTotal + expenses + adjustment - advance;

  function handleAddRow() {
    setAdditionalItems([...additionalItems, { name: "", quantity: 1, unitId: "", priceUnit: 0, specifications: "" }]);
  }

  function removeAdditionalItem(index: number) {
    setAdditionalItems(additionalItems.filter((_, i) => i !== index));
  }

  function updateAdditionalItem<K extends keyof typeof additionalItems[number]>(
    index: number, field: K, value: typeof additionalItems[number][K]
  ) {
    const next = [...additionalItems];
    next[index] = { ...next[index], [field]: value };
    setAdditionalItems(next);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submitInspection({
        factoryFloorOrderId: orderId,
        finalAmount: paymentAmount,
        memo: memo || undefined,
        additionalItems: additionalItems.length > 0 ? additionalItems : undefined,
        expenses: expenses || undefined,
        adjustmentAmount: adjustment || undefined,
        advancePayment: advance || undefined,
      });
      setOrdererSuccess("納品内容確認依頼を送信しました");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col bg-white min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="relative flex h-14 items-center justify-center px-4">
          <button
            onClick={() => router.back()}
            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[16px] font-bold text-knock-text">納品金額算定</span>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
        {/* 読み取り専用フィールド */}
        <ReadOnlyField
          label="注文No"
          value={floor.orderNumber ? String(floor.orderNumber).padStart(5, "0") : "—"}
        />
        <ReadOnlyField label="工事コード" value={floor.code ?? "—"} />
        <ReadOnlyField label="工事名" value={floor.name ?? "—"} />
        <ReadOnlyField label="納品合計金額（A）" value={formatYen(totalAmount)} />
        <ReadOnlyField label="うち消費税（B）" value={formatYen(tax)} />
        <ReadOnlyField label="工事金額(税抜)（A）−（B）" value={formatYen(taxExclusive)} />

        {/* 注文金額ボックス */}
        <div className="rounded-xl border border-gray-200 py-4 text-center">
          <p className="text-[12px] text-knock-text-secondary">注文金額</p>
          <p className="mt-1 text-[24px] font-bold text-knock-text">{formatYen(totalAmount)}</p>
        </div>

        {/* 工事金額明細（読み取り専用） */}
        {floor.priceDetails.length > 0 && (
          <div>
            <p className="mb-1 text-[13px] font-bold text-knock-text">工事金額明細</p>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] text-knock-text-secondary">名称</span>
              <span className="text-[11px] text-knock-text-secondary">納品金額（税抜）</span>
            </div>
            <div className="flex flex-col gap-2">
              {floor.priceDetails.map((detail) => (
                <EditableRow
                  key={detail.id}
                  borderColor="#F5A623"
                  name={detail.name}
                  amount={formatYen(Math.ceil(detail.quantity * Number(detail.priceUnit)))}
                  nameReadOnly
                />
              ))}
            </div>
          </div>
        )}

        {/* 追加の工事金額明細（編集可能） */}
        <div className="rounded-2xl bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[14px] font-bold text-knock-text">明細</p>
            <button
              type="button"
              onClick={handleAddRow}
              className="rounded-lg bg-knock-accent/10 px-3 py-1.5 text-[12px] font-bold text-knock-accent transition-colors active:bg-knock-accent/20"
            >
              + 行を追加
            </button>
          </div>

          {additionalItems.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-gray-400">
              追加の明細行がありません
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {additionalItems.map((item, i) => {
                const rowSubtotal = Math.ceil(item.quantity * item.priceUnit);
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-gray-200 bg-gray-50/50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-bold text-gray-500">#{i + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeAdditionalItem(i)}
                        className="text-[12px] text-red-500"
                      >
                        削除
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">
                          項目名 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateAdditionalItem(i, "name", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[14px] text-knock-text outline-none focus:border-knock-accent focus:ring-1 focus:ring-knock-accent"
                          placeholder="例: 塗装工事"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-gray-500">数量</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={item.quantity}
                            onChange={(e) => updateAdditionalItem(i, "quantity", Number(e.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[14px] text-knock-text outline-none focus:border-knock-accent focus:ring-1 focus:ring-knock-accent"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-gray-500">単位</label>
                          <select
                            value={item.unitId}
                            onChange={(e) => updateAdditionalItem(i, "unitId", e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[14px] text-knock-text outline-none focus:border-knock-accent focus:ring-1 focus:ring-knock-accent"
                          >
                            <option value="">-</option>
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">単価</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={item.priceUnit}
                            onChange={(e) => updateAdditionalItem(i, "priceUnit", Number(e.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-8 text-[14px] text-knock-text outline-none focus:border-knock-accent focus:ring-1 focus:ring-knock-accent"
                            placeholder="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">円</span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">仕様</label>
                        <input
                          type="text"
                          value={item.specifications}
                          onChange={(e) => updateAdditionalItem(i, "specifications", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[14px] text-knock-text outline-none focus:border-knock-accent focus:ring-1 focus:ring-knock-accent"
                          placeholder="仕様・備考"
                        />
                      </div>

                      <div className="mt-1 text-right text-[13px] font-bold text-knock-text">
                        小計: {formatYen(rowSubtotal)}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-xl bg-knock-accent/5 px-4 py-3 text-right">
                <span className="text-[13px] text-gray-600">合計: </span>
                <span className="text-[16px] font-bold text-knock-accent">
                  {formatYen(additionalTotal)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 諸経費（税込） */}
        <div>
          <p className="mb-2 text-[13px] font-bold text-knock-text">諸経費（税込）</p>
          <EditableRow
            borderColor="#F5A623"
            name="諸経費"
            amount={expensesAmount}
            nameReadOnly
            onAmountChange={setExpensesAmount}
          />
        </div>

        {/* 調整金額（税込） */}
        <div>
          <p className="mb-2 text-[13px] font-bold text-knock-text">調整金額（税込）</p>
          <div className="flex flex-col gap-2">
            <EditableRow
              borderColor="#333333"
              name="調整金額"
              amount={adjustmentAmount}
              nameReadOnly
              onAmountChange={setAdjustmentAmount}
            />
            <EditableRow
              borderColor="#EF4444"
              name="前払金"
              amount={advancePayment}
              nameReadOnly
              onAmountChange={setAdvancePayment}
              amountPrefix="▲"
              amountClassName="text-red-500 font-bold"
            />
          </div>
        </div>

        {/* 支払金額ボックス */}
        <div className="rounded-xl border-2 border-red-400 py-4 text-center">
          <p className="text-[12px] font-bold text-red-500">支払金額</p>
          <p className="mt-1 text-[24px] font-bold text-knock-text">{formatYen(paymentAmount)}</p>
        </div>

        {/* 備考 */}
        <div>
          <p className="mb-1 text-[13px] font-bold text-knock-text">
            備考
            <span className="ml-1 text-[11px] font-normal text-knock-text-secondary">
              （前払金の支払日などを記載すると納品書に反映されます）
            </span>
          </p>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-[#F5F5F5] p-3 text-[14px] text-knock-text outline-none"
            rows={4}
          />
        </div>

        {/* アクションボタン */}
        <div className="pt-2">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={submitting}
            className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {submitting ? "処理中..." : "納品内容確認依頼"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="納品内容確認依頼"
        message="納品内容の確認依頼を送信しますか？"
        confirmLabel={submitting ? "処理中..." : "はい"}
        cancelLabel="いいえ"
        variant="primary"
      />
      <AlertDialog
        open={!!ordererSuccess}
        onClose={() => router.replace(`/orders/${orderId}`)}
        title="完了"
        message={ordererSuccess}
      />
    </div>
  );
}
