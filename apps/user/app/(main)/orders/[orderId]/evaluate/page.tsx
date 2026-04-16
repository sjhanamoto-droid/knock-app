"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { getOrderDetail } from "@/lib/actions/orders";
import { submitEvaluation } from "@/lib/actions/evaluations";
import { ConfirmDialog, AlertDialog } from "@knock/ui";

type OrderDetail = Awaited<ReturnType<typeof getOrderDetail>>;

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="80" height="6" viewBox="0 0 80 6" fill="none">
      <path
        d="M0 3 Q10 0 20 3 Q30 6 40 3 Q50 0 60 3 Q70 6 80 3"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StarRating({
  value,
  onChange,
  color,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="text-[28px] transition-all active:scale-110"
        >
          {star <= value ? (
            <span style={{ color }}>★</span>
          ) : (
            <span className="text-gray-300">☆</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function EvaluatePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { accentColor, isOrderer } = useMode();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [technicalSkill, setTechnicalSkill] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [reliability, setReliability] = useState(0);
  const [comment, setComment] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    getOrderDetail(orderId)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  async function handleSubmit() {
    setShowConfirm(false);
    if (!order) return;

    const floor = order.factoryFloor;
    const evaluateeCompanyId = isOrderer
      ? floor.workCompany?.id
      : floor.company?.id;

    if (!evaluateeCompanyId) return;

    setSubmitting(true);
    try {
      await submitEvaluation({
        factoryFloorOrderId: orderId,
        evaluateeCompanyId,
        technicalSkill,
        communication,
        reliability,
        comment: comment || undefined,
      });
      setSuccessMessage("評価を送信しました");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
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

  if (!order) {
    return <div className="p-4 text-center text-knock-text-muted">取引が見つかりません</div>;
  }

  const floor = order.factoryFloor;
  const targetName = isOrderer ? floor.workCompany?.name : floor.company?.name;

  return (
    <div className="flex flex-col bg-[#F5F5F5]">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push("/")}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-[17px] font-bold tracking-wide text-knock-text">取引の評価</h1>
            <WavyUnderline color={accentColor} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-3 pb-8">
        <div className="text-center">
          <p className="text-[14px] text-knock-text">
            {floor.name}の取引が完了しました
          </p>
          <p className="mt-1 text-[15px] font-bold text-knock-text">
            {targetName} 様を評価してください
          </p>
        </div>

        {/* 技術力 */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h3 className="mb-1 text-[14px] font-bold text-knock-text">技術力</h3>
          <p className="mb-2 text-[12px] text-knock-text-secondary">仕上がりの品質</p>
          <StarRating value={technicalSkill} onChange={setTechnicalSkill} color={accentColor} />
        </div>

        {/* コミュニケーション */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h3 className="mb-1 text-[14px] font-bold text-knock-text">コミュニケーション</h3>
          <p className="mb-2 text-[12px] text-knock-text-secondary">連絡のスムーズさ</p>
          <StarRating value={communication} onChange={setCommunication} color={accentColor} />
        </div>

        {/* 信頼性 */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <h3 className="mb-1 text-[14px] font-bold text-knock-text">信頼性</h3>
          <p className="mb-2 text-[12px] text-knock-text-secondary">時間や約束を守るか</p>
          <StarRating value={reliability} onChange={setReliability} color={accentColor} />
        </div>

        {/* コメント */}
        <div>
          <label className="mb-1 block text-[13px] font-bold text-knock-text">
            コメント（任意）
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="取引の感想をお書きください"
            className="w-full rounded-xl bg-[#F0F0F0] border-none px-4 py-3 text-[14px]"
          />
        </div>

        <button
          onClick={() => {
            if (technicalSkill === 0 || communication === 0 || reliability === 0) {
              alert("すべての項目を評価してください");
              return;
            }
            setShowConfirm(true);
          }}
          disabled={submitting}
          className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          {submitting ? "送信中..." : "評価を送信する"}
        </button>

        <button
          onClick={() => router.push("/")}
          className="text-center text-[13px] text-knock-text-secondary"
        >
          あとで評価する
        </button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="評価の送信"
        message="評価を送信しますか？"
        confirmLabel={submitting ? "送信中..." : "はい"}
        cancelLabel="いいえ"
        variant="primary"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => router.push("/")}
        title="完了"
        message={successMessage}
      />
    </div>
  );
}
