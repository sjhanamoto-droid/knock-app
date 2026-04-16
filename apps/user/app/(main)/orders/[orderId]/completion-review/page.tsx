"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getOrderDetail, requestRevision } from "@/lib/actions/orders";
import { ConfirmDialog, AlertDialog } from "@knock/ui";

type OrderDetail = Awaited<ReturnType<typeof getOrderDetail>>;

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
      <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function CompletionReviewPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { accentColor } = useMode();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showRevisionConfirm, setShowRevisionConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    getOrderDetail(orderId)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleRevision() {
    setSubmitting(true);
    try {
      await requestRevision(orderId);
      setSuccessMessage("再依頼を送信しました");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
      setShowRevisionConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!order || !order.completionReport) {
    return <div className="p-4 text-center text-knock-text-muted">完了報告が見つかりません</div>;
  }

  const floor = order.factoryFloor;
  const report = order.completionReport;

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="relative flex h-14 items-center justify-center px-4">
          <button
            onClick={() => router.back()}
            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[16px] font-bold text-knock-text">完了報告の確認</span>
            <WavyUnderline color={accentColor} />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 bg-[#F5F5F5] px-4 pt-3 pb-8">
        <p className="text-[13px] text-knock-text-secondary">
          {floor.name ?? ""} / {floor.workCompany?.name ?? ""}
        </p>

        {/* 完了日 */}
        <div
          className="rounded-2xl border-l-4 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
          style={{ borderLeftColor: accentColor }}
        >
          <h3 className="mb-1 text-[12px] font-bold text-knock-text-secondary">施工完了日</h3>
          <p className="text-[14px] text-knock-text">
            {new Date(report.completionDate).toLocaleDateString("ja-JP")}
          </p>
        </div>

        {/* コメント */}
        {report.comment && (
          <div
            className="rounded-2xl border-l-4 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
            style={{ borderLeftColor: accentColor }}
          >
            <h3 className="mb-1 text-[12px] font-bold text-knock-text-secondary">報告コメント</h3>
            <p className="text-[14px] text-knock-text">{report.comment}</p>
          </div>
        )}

        {/* 施工写真 */}
        {(report.photos as string[]).length > 0 && (
          <div
            className="rounded-2xl border-l-4 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
            style={{ borderLeftColor: accentColor }}
          >
            <h3 className="mb-2 text-[12px] font-bold text-knock-text-secondary">
              施工写真 ({(report.photos as string[]).length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(report.photos as string[]).map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl border border-gray-200">
                  <img
                    src={url}
                    alt={`施工写真 ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 追加工事 */}
        {report.hasAdditionalWork && (
          <div
            className="rounded-2xl border-l-4 bg-yellow-50 p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
            style={{ borderLeftColor: accentColor }}
          >
            <h3 className="mb-1 text-[12px] font-bold text-amber-700">追加工事あり</h3>
            <p className="text-[14px] text-knock-text">{report.additionalWorkDescription}</p>
            {report.additionalWorkAmount && (
              <p className="mt-1 text-[14px] font-bold" style={{ color: accentColor }}>
                ¥{Number(report.additionalWorkAmount).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowRevisionConfirm(true)}
            disabled={submitting}
            className="flex-1 rounded-xl border-2 border-red-500 py-3.5 text-[15px] font-bold text-red-500 transition-all active:scale-[0.97] disabled:opacity-50"
          >
            再依頼
          </button>
          <button
            onClick={() => router.push(`/orders/${orderId}/inspection`)}
            disabled={submitting}
            className="flex-1 rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            承認
          </button>
        </div>
      </div>

      {/* 再依頼確認ダイアログ */}
      <ConfirmDialog
        open={showRevisionConfirm}
        onClose={() => setShowRevisionConfirm(false)}
        onConfirm={handleRevision}
        title="完了報告の再依頼"
        message="受注者に完了報告の再提出を依頼しますか？"
        confirmLabel={submitting ? "処理中..." : "再依頼する"}
        cancelLabel="キャンセル"
        variant="danger"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => router.replace(`/orders/${orderId}`)}
        title="完了"
        message={successMessage}
      />
    </div>
  );
}
