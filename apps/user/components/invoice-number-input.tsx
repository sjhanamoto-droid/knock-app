"use client";

/**
 * 保存済みの invoiceNumber（"T"+13桁 など）から数字部分のみを取り出す。
 * 先頭Tを除去し、数字以外を除き、13桁に丸める。
 */
export function toInvoiceDigits(full: string | null | undefined): string {
  return (full ?? "").replace(/^T/i, "").replace(/\D/g, "").slice(0, 13);
}

/**
 * インボイス（適格請求書）番号の入力欄。
 * 先頭「T」を固定表示（削除不可）し、入力欄は数字のみ・13桁上限で保持する。
 * value/onChange はいずれも「Tを除く数字部分」を扱う。保存時は呼び出し側で
 * `T${value}` を付与すること。
 */
export function InvoiceNumberInput({
  value,
  onChange,
  showCounter = true,
}: {
  value: string;
  onChange: (digits: string) => void;
  showCounter?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center rounded-xl bg-[#F0F0F0] px-4">
        <span className="select-none text-[14px] font-bold text-knock-text">T</span>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 13))}
          placeholder="1234567890123"
          maxLength={13}
          className="w-full bg-transparent px-2 py-3 text-[14px] outline-none"
        />
      </div>
      {showCounter && (
        <p className="mt-1 text-[11px] text-knock-text-secondary">
          先頭のTを除く13桁の数字（{value.length}/13）
        </p>
      )}
    </div>
  );
}
