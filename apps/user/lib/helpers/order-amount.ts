/**
 * 発注書の金額計算（注文書 generateOrderSheet と同じ基準）。
 * 注文書が未発行（発注依頼中など）の工事の金額表示にも使う。
 */

type LineItem = { quantity?: number | null; priceUnit?: number | bigint | { toString(): string } | null };

const TAX_RATE = 0.1;

function sumLineItems(items: LineItem[]): number {
  return items.reduce(
    (sum, p) => sum + Math.ceil(Number(p.quantity ?? 0) * Number(p.priceUnit ?? 0)),
    0
  );
}

/**
 * 税抜小計。
 * - 追加注文: 追加明細(inspectionData.priceDetails)の合計
 * - 通常注文: 現場の明細合計。明細が無ければ現場の totalAmount
 */
export function calcOrderSubtotal(params: {
  isAdditional: boolean;
  additionalDetails?: LineItem[] | null;
  floorDetails: LineItem[];
  floorTotalAmount?: bigint | null;
}): bigint {
  if (params.isAdditional && params.additionalDetails?.length) {
    return BigInt(sumLineItems(params.additionalDetails));
  }
  const detailsTotal = sumLineItems(params.floorDetails);
  return detailsTotal > 0 ? BigInt(detailsTotal) : (params.floorTotalAmount ?? BigInt(0));
}

/** 消費税（10%・切り上げ） */
export function calcTax(subtotal: bigint): bigint {
  return BigInt(Math.ceil(Number(subtotal) * TAX_RATE));
}
