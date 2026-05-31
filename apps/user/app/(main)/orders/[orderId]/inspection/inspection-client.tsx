"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getOrderDetail, submitInspection, approveDelivery, rejectInspection } from "@/lib/actions/orders";
import { useToast, ConfirmDialog, AlertDialog } from "@knock/ui";

type Unit = { id: string; name: string };

type OrderDetail = Awaited<ReturnType<typeof getOrderDetail>>;

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
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [approvedForEval, setApprovedForEval] = useState(false);

  const floor = order.factoryFloor;

  // approveDelivery / rejectInspection guards both require factoryFloor.status === "COMPLETED"
  // (orders.ts:980 approveDelivery, orders.ts:857 rejectInspection)
  const isActionable = floor.status === "COMPLETED";
  const statusTitle =
    floor.status === "DELIVERY_APPROVED" || floor.status === "INVOICED" || floor.status === "DEAL_COMPLETED"
      ? "この納品金額は承認済みです"
      : floor.status === "CONFIRMED"
        ? "この納品金額は差し戻し済みです"
        : "現在この操作はできません";
  const statusNote =
    floor.status === "DELIVERY_APPROVED" || floor.status === "INVOICED" || floor.status === "DEAL_COMPLETED"
      ? "納品書は発行済みです。現場から内容をご確認いただけます。"
      : floor.status === "CONFIRMED"
        ? "発注者に差し戻し済みです。発注者の再依頼をお待ちください。"
        : "納品金額の確認待ちの状態ではありません。現場から状況をご確認ください。";

  const inspection = (order.inspectionData as InspectionData | null) ?? {};
  const additionalItems = inspection.additionalItems ?? [];
  const expensesVal = inspection.expenses ?? 0;
  const adjustmentVal = inspection.adjustmentAmount ?? 0;
  const advanceVal = inspection.advancePayment ?? 0;
  const memoVal = inspection.memo ?? "";

  const priceDetailsSubtotal = floor.priceDetails.reduce(
    (sum, d) => sum + Math.ceil(d.quantity * Number(d.priceUnit)), 0
  );

  const totalAmount = Number(floor.totalAmount ?? 0) || Math.round(priceDetailsSubtotal * 1.1);
  const taxExclusive = Math.round(totalAmount / 1.1);
  const tax = totalAmount - taxExclusive;

  const additionalTotal = additionalItems.reduce(
    (sum, item) => sum + Math.ceil(item.quantity * item.priceUnit), 0
  );

  const paymentAmount = totalAmount + additionalTotal + expensesVal + adjustmentVal - advanceVal;

  function getUnitName(unitId: string): string {
    if (!unitId) return "-";
    const unit = units.find((u) => u.id === unitId);
    return unit?.name ?? "-";
  }

  async function handleApprove() {
    setSubmitting(true);
    try {
      await approveDelivery(order.id);
      setApprovedForEval(true);
      setSuccessMessage("納品金額を承認しました。続けて取引相手を評価できます。");
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

  const roInput =
    "w-full rounded-lg border border-gray-200 bg-[#F0F0F0] px-3 py-2.5 text-[14px] text-knock-text-secondary outline-none cursor-default";

  return (
    <div className="flex flex-col bg-white min-h-dvh">
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
        <div className="rounded-xl bg-blue-50 p-3 text-center">
          <span className="text-[14px] font-bold text-knock-blue">
            納品金額の内容をご確認ください
          </span>
        </div>

        <ReadOnlyField
          label="注文No"
          value={floor.orderNumber ? String(floor.orderNumber).padStart(5, "0") : "—"}
        />
        <ReadOnlyField label="工事コード" value={floor.code ?? "—"} />
        <ReadOnlyField label="工事名" value={floor.name ?? "—"} />
        <ReadOnlyField label="納品合計金額（A）" value={formatYen(totalAmount)} />
        <ReadOnlyField label="うち消費税（B）" value={formatYen(tax)} />
        <ReadOnlyField label="工事金額(税抜)（A）−（B）" value={formatYen(taxExclusive)} />

        <div className="rounded-xl border border-gray-200 py-4 text-center">
          <p className="text-[12px] text-knock-text-secondary">注文金額</p>
          <p className="mt-1 text-[24px] font-bold text-knock-text">{formatYen(totalAmount)}</p>
        </div>

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
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">項目名</label>
                        <input type="text" value={item.name || ""} readOnly className={roInput} />
                      </div>

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

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">単価</label>
                        <div className="relative">
                          <input type="text" value={String(item.priceUnit)} readOnly className={`${roInput} pr-8`} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">円</span>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-gray-500">仕様</label>
                        <input type="text" value={item.specifications || ""} readOnly className={roInput} placeholder="仕様・備考" />
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

        <div>
          <p className="mb-2 text-[13px] font-bold text-knock-text">諸経費（税込）</p>
          <EditableRow
            borderColor="#F5A623"
            name="諸経費"
            amount={expensesVal ? String(expensesVal) : ""}
            nameReadOnly
          />
        </div>

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

        <div className="rounded-xl border-2 border-red-400 py-4 text-center">
          <p className="text-[12px] font-bold text-red-500">支払金額</p>
          <p className="mt-1 text-[24px] font-bold text-knock-text">{formatYen(paymentAmount)}</p>
        </div>

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

        {isActionable ? (
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
        ) : (
          <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <p className="text-[15px] font-bold text-knock-text">{statusTitle}</p>
            <p className="mt-1.5 text-[13px] text-knock-text-secondary">{statusNote}</p>
            <Link href={`/sites/${floor.id}`} className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl px-6 py-2.5 text-[14px] font-bold text-white transition-all active:scale-[0.97]" style={{ backgroundColor: accentColor }}>現場を確認する</Link>
          </div>
        )}
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
        onClose={() =>
          router.replace(
            approvedForEval ? `/orders/${order.id}/evaluate` : `/orders/${order.id}`
          )
        }
        title="完了"
        message={successMessage}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   メインコンポーネント: 発注者 = 編集 / 受注者 = 確認
   ═══════════════════════════════════════════════════════ */
interface Props {
  initialOrder: OrderDetail;
  initialUnits: Unit[];
  orderId: string;
}

export function InspectionClient({ initialOrder, initialUnits, orderId }: Props) {
  const router = useRouter();
  const { accentColor, isOrderer } = useMode();
  const { toast } = useToast();
  const [order] = useState<OrderDetail | null>(initialOrder);
  const [submitting, setSubmitting] = useState(false);

  const [units] = useState<Unit[]>(initialUnits);

  const defaultDeliveryDate = new Date().toISOString().split("T")[0];

  // Initialise editable state from server-fetched data
  const initInspection = (initialOrder?.inspectionData as InspectionData | null) ?? null;
  const initAdditionalItems = initInspection?.additionalItems?.length
    ? initInspection.additionalItems
    : initialOrder?.completionReport?.hasAdditionalWork && initialOrder.completionReport.additionalWorkAmount
      ? [{
          name: initialOrder.completionReport.additionalWorkDescription ?? "追加工事",
          quantity: 1,
          unitId: "",
          priceUnit: Number(initialOrder.completionReport.additionalWorkAmount),
          specifications: "",
        }]
      : [];

  const [additionalItems, setAdditionalItems] = useState<{
    name: string;
    quantity: number;
    unitId: string;
    priceUnit: number;
    specifications: string;
  }[]>(initAdditionalItems);
  const [expensesAmount, setExpensesAmount] = useState(
    initInspection?.expenses
      ? String(initInspection.expenses)
      : initialOrder?.factoryFloor.expenses
        ? String(Number(initialOrder.factoryFloor.expenses))
        : ""
  );
  const [adjustmentAmount, setAdjustmentAmount] = useState(
    initInspection?.adjustmentAmount ? String(initInspection.adjustmentAmount) : ""
  );
  const [advancePayment, setAdvancePayment] = useState(
    initInspection?.advancePayment
      ? String(initInspection.advancePayment)
      : initialOrder?.factoryFloor.totalAdvancePayment
        ? String(Number(initialOrder.factoryFloor.totalAdvancePayment))
        : ""
  );
  const [memo, setMemo] = useState(initInspection?.memo ?? "");
  const [deliveryDate, setDeliveryDate] = useState(
    (initInspection as Record<string, unknown> | null)?.deliveryDate as string ?? defaultDeliveryDate
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [ordererSuccess, setOrdererSuccess] = useState("");

  if (!order) {
    return <div className="p-4 text-center text-knock-text-muted">取引が見つかりません</div>;
  }

  // 受注者は確認画面を表示
  if (!isOrderer) {
    return <ContractorView order={order} accentColor={accentColor} units={units} />;
  }

  // ─── 以下、発注者用の編集画面 ───

  const floor = order.factoryFloor;

  // submitInspection guard requires factoryFloor.status === "INSPECTION" (orders.ts:770)
  const isActionable = floor.status === "INSPECTION";
  const statusTitle =
    floor.status === "COMPLETED"
      ? "納品内容確認依頼は送信済みです"
      : floor.status === "DELIVERY_APPROVED" || floor.status === "INVOICED" || floor.status === "DEAL_COMPLETED"
        ? "この納品は承認済みです"
        : "現在この操作はできません";
  const statusNote =
    floor.status === "COMPLETED"
      ? "受注者の確認をお待ちください。現場から状況をご確認いただけます。"
      : floor.status === "DELIVERY_APPROVED" || floor.status === "INVOICED" || floor.status === "DEAL_COMPLETED"
        ? "納品書は発行済みです。現場から内容をご確認いただけます。"
        : "検収を実行できる状態ではありません。現場から状況をご確認ください。";

  const priceDetailsSubtotal = floor.priceDetails.reduce(
    (sum, d) => sum + Math.ceil(d.quantity * Number(d.priceUnit)), 0
  );

  const totalAmount = Number(floor.totalAmount ?? 0) || Math.round(priceDetailsSubtotal * 1.1);
  const taxExclusive = Math.round(totalAmount / 1.1);
  const tax = totalAmount - taxExclusive;

  const additionalTotal = additionalItems.reduce(
    (sum, item) => sum + Math.ceil(item.quantity * item.priceUnit), 0
  );

  const expenses = parseInt(expensesAmount) || 0;
  const adjustment = parseInt(adjustmentAmount) || 0;
  const advance = parseInt(advancePayment) || 0;
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
    if (deliveryDate !== defaultDeliveryDate) {
      const d = new Date(deliveryDate);
      const label = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
      if (!confirm(`納品日が変更されています（${label}）。この日付でよろしいですか？`)) {
        return;
      }
    }
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
        deliveryDate,
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
        <ReadOnlyField
          label="注文No"
          value={floor.orderNumber ? String(floor.orderNumber).padStart(5, "0") : "—"}
        />
        <ReadOnlyField label="工事コード" value={floor.code ?? "—"} />
        <ReadOnlyField label="工事名" value={floor.name ?? "—"} />
        <ReadOnlyField label="納品合計金額（A）" value={formatYen(totalAmount)} />
        <ReadOnlyField label="うち消費税（B）" value={formatYen(tax)} />
        <ReadOnlyField label="工事金額(税抜)（A）−（B）" value={formatYen(taxExclusive)} />

        <div className="rounded-xl border border-gray-200 py-4 text-center">
          <p className="text-[12px] text-knock-text-secondary">注文金額</p>
          <p className="mt-1 text-[24px] font-bold text-knock-text">{formatYen(totalAmount)}</p>
        </div>

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

        <div className="rounded-xl border-2 border-red-400 py-4 text-center">
          <p className="text-[12px] font-bold text-red-500">支払金額</p>
          <p className="mt-1 text-[24px] font-bold text-knock-text">{formatYen(paymentAmount)}</p>
        </div>

        <div>
          <p className="mb-1 text-[13px] font-bold text-knock-text">
            納品日
            <span className="ml-1 text-[11px] font-normal text-knock-text-secondary">
              （納品書に記載される日付です）
            </span>
          </p>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-[#F5F5F5] px-3 py-2.5 text-[14px] text-knock-text outline-none focus:border-knock-accent focus:ring-1 focus:ring-knock-accent"
          />
        </div>

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

        {isActionable ? (
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
        ) : (
          <div className="rounded-2xl bg-white p-5 text-center shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <p className="text-[15px] font-bold text-knock-text">{statusTitle}</p>
            <p className="mt-1.5 text-[13px] text-knock-text-secondary">{statusNote}</p>
            <Link href={`/sites/${floor.id}`} className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl px-6 py-2.5 text-[14px] font-bold text-white transition-all active:scale-[0.97]" style={{ backgroundColor: accentColor }}>現場を確認する</Link>
          </div>
        )}
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
