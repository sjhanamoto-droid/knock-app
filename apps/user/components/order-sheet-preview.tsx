"use client";

import { formatCurrency } from "@knock/utils";

interface CompanyInfo {
  name?: string | null;
  postalCode?: string | null;
  prefecture?: string | null;
  city?: string | null;
  streetAddress?: string | null;
  building?: string | null;
  invoiceNumber?: string | null;
}

interface PriceDetail {
  name: string | null;
  quantity: number | null;
  priceUnit: number | bigint | null;
  unit?: { name: string | null } | null;
}

interface OrderSheetPreviewProps {
  orderCompany: CompanyInfo | null;
  workerCompany: CompanyInfo | null;
  siteName: string | null;
  siteAddress: string | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  contentRequest: string | null;
  priceDetails: PriceDetail[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  onConfirm: () => void;
  onBack: () => void;
  submitting: boolean;
  accentColor: string;
}

function formatAddress(company: CompanyInfo | null): string {
  if (!company) return "";
  return [
    company.postalCode ? `〒${company.postalCode}` : "",
    company.prefecture ?? "",
    company.city ?? "",
    company.streetAddress ?? "",
    company.building ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDate(d: string | Date | null): string {
  if (!d) return "未設定";
  return new Date(d).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function OrderSheetPreview({
  orderCompany,
  workerCompany,
  siteName,
  siteAddress,
  startDate,
  endDate,
  contentRequest,
  priceDetails,
  subtotal,
  taxAmount,
  totalAmount,
  onConfirm,
  onBack,
  submitting,
  accentColor,
}: OrderSheetPreviewProps) {
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-4">
      {/* 戻るボタン */}
      <button
        onClick={onBack}
        className="self-start text-[14px] text-knock-blue"
      >
        ← 発注内容に戻る
      </button>

      <h2 className="text-center text-[18px] font-bold text-knock-text">
        注文書プレビュー
      </h2>

      {/* 注文書本体 */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        {/* ヘッダー */}
        <div className="border-b border-gray-200 px-5 py-4 text-center">
          <h3 className="text-[20px] font-bold tracking-widest text-gray-900">
            注 文 書
          </h3>
          <p className="mt-1 text-[12px] text-gray-500">
            発行日: {today}
          </p>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {/* 受注者（宛先） */}
          <div className="border-b border-gray-100 pb-3">
            <p className="text-[15px] font-bold text-gray-900">
              {workerCompany?.name ?? ""} 御中
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {formatAddress(workerCompany)}
            </p>
          </div>

          {/* 発注者（差出人） */}
          <div className="flex flex-col items-end border-b border-gray-100 pb-3">
            <p className="text-[13px] font-bold text-gray-900">
              {orderCompany?.name ?? ""}
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {formatAddress(orderCompany)}
            </p>
            {orderCompany?.invoiceNumber && (
              <p className="mt-0.5 text-[11px] text-gray-500">
                登録番号: {orderCompany.invoiceNumber}
              </p>
            )}
          </div>

          {/* 現場情報 */}
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="flex flex-col gap-1.5">
              <div>
                <span className="text-[11px] font-bold text-gray-500">
                  現場名
                </span>
                <p className="text-[13px] font-semibold text-gray-900">
                  {siteName ?? "未設定"}
                </p>
              </div>
              {siteAddress && (
                <div>
                  <span className="text-[11px] font-bold text-gray-500">
                    住所
                  </span>
                  <p className="text-[13px] text-gray-700">{siteAddress}</p>
                </div>
              )}
              <div>
                <span className="text-[11px] font-bold text-gray-500">
                  工期
                </span>
                <p className="text-[13px] text-gray-700">
                  {formatDate(startDate)} 〜 {formatDate(endDate)}
                </p>
              </div>
              {contentRequest && (
                <div>
                  <span className="text-[11px] font-bold text-gray-500">
                    作業内容
                  </span>
                  <p className="text-[13px] text-gray-700">{contentRequest}</p>
                </div>
              )}
            </div>
          </div>

          {/* 明細テーブル */}
          {priceDetails.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-bold text-gray-600">
                明細
              </p>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-2.5 py-2 text-left font-bold text-gray-600">
                        項目
                      </th>
                      <th className="px-2.5 py-2 text-right font-bold text-gray-600">
                        数量
                      </th>
                      <th className="px-2.5 py-2 text-right font-bold text-gray-600">
                        単価
                      </th>
                      <th className="px-2.5 py-2 text-right font-bold text-gray-600">
                        金額
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceDetails.map((item, i) => {
                      const qty = item.quantity ?? 0;
                      const price = Number(item.priceUnit ?? 0);
                      const amount = Math.ceil(qty * price);
                      return (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2.5 py-2 text-gray-800">
                            {item.name ?? ""}
                            {item.unit?.name ? ` (${item.unit.name})` : ""}
                          </td>
                          <td className="px-2.5 py-2 text-right text-gray-800">
                            {qty}
                          </td>
                          <td className="px-2.5 py-2 text-right text-gray-800">
                            {formatCurrency(price)}
                          </td>
                          <td className="px-2.5 py-2 text-right text-gray-800">
                            {formatCurrency(amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 金額サマリー */}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex flex-col gap-1 text-[13px]">
              <div className="flex justify-between">
                <span className="text-gray-500">小計</span>
                <span className="text-gray-800">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">消費税（10%）</span>
                <span className="text-gray-800">
                  {formatCurrency(taxAmount)}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-gray-200 pt-2">
                <span className="text-[14px] font-bold text-gray-900">
                  合計金額（税込）
                </span>
                <span
                  className="text-[16px] font-bold"
                  style={{ color: accentColor }}
                >
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 確認ボタン */}
      <p className="text-center text-[12px] text-knock-text-secondary">
        上記の内容で注文書を発行します
      </p>

      <button
        onClick={onConfirm}
        disabled={submitting}
        className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
        style={{ backgroundColor: accentColor }}
      >
        {submitting ? "処理中..." : "注文書を作成する"}
      </button>

      <button
        onClick={onBack}
        className="w-full rounded-xl border-2 border-gray-300 py-3.5 text-[15px] font-bold text-knock-text-secondary transition-all active:scale-[0.97]"
      >
        戻る
      </button>
    </div>
  );
}
