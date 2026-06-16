"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  readonly,
}: {
  value: number;
  onChange?: (v: number) => void;
  color: string;
  readonly?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // ポインタのX座標から星の値(1〜5)を算出
  function valueFromClientX(clientX: number): number {
    const el = rowRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const star = Math.ceil(ratio * 5);
    return Math.min(5, Math.max(1, star));
  }

  if (readonly) {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className="text-[28px]">
            {star <= value ? (
              <span style={{ color }}>★</span>
            ) : (
              <span className="text-gray-300">☆</span>
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={rowRef}
        className="flex w-max touch-none gap-1 select-none"
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          onChange?.(valueFromClientX(e.clientX));
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          onChange?.(valueFromClientX(e.clientX));
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className="pointer-events-none text-[28px] transition-all">
            {star <= value ? (
              <span style={{ color }}>★</span>
            ) : (
              <span className="text-gray-300">☆</span>
            )}
          </span>
        ))}
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="w-[180px] accent-current"
        style={{ accentColor: color }}
        aria-label="評価スライダー"
      />
    </div>
  );
}

interface CriteriaLabels {
  technical: { title: string; desc: string };
  communication: { title: string; desc: string };
  reliability: { title: string; desc: string };
}

interface Props {
  initialOrder: OrderDetail;
  orderId: string;
  viewerCompanyId: string;
}

export function EvaluateClient({ initialOrder, orderId, viewerCompanyId }: Props) {
  const router = useRouter();
  const { accentColor } = useMode();
  const [order, setOrder] = useState<OrderDetail | null>(initialOrder);
  const [submitting, setSubmitting] = useState(false);

  const [technicalSkill, setTechnicalSkill] = useState(5);
  const [communication, setCommunication] = useState(5);
  const [reliability, setReliability] = useState(5);
  const [comment, setComment] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  if (!order) {
    return <div className="p-4 text-center text-knock-text-muted">取引が見つかりません</div>;
  }

  const floor = order.factoryFloor;
  // 自社が発注者か受注者かを「実際の取引上の役割」で判定（アクティブモードに依存しない）
  const isOrderer = floor.company?.id === viewerCompanyId;
  const evaluatee = isOrderer ? floor.workCompany : floor.company;
  const evaluateeCompanyId = evaluatee?.id;
  const targetName = evaluatee?.name;

  const evaluations = order.evaluations ?? [];
  const myEvaluation = evaluations.find((e) => e.evaluatorCompanyId === viewerCompanyId) ?? null;
  const receivedEvaluation =
    evaluations.find((e) => e.evaluateeCompanyId === viewerCompanyId) ?? null;

  // 評価対象（相手）の役割に応じてラベルを出し分け
  const labels: CriteriaLabels = isOrderer
    ? {
        technical: { title: "技術力", desc: "仕上がりの品質" },
        communication: { title: "コミュニケーション", desc: "連絡のスムーズさ" },
        reliability: { title: "信頼性", desc: "時間や約束を守るか" },
      }
    : {
        technical: { title: "対応・段取り", desc: "指示や段取りの明確さ" },
        communication: { title: "コミュニケーション", desc: "連絡のスムーズさ・丁寧さ" },
        reliability: { title: "信頼性", desc: "支払い・約束の確実さ" },
      };

  // 相手が自分を評価した内容を表示する際のラベル（自分の役割に応じる）
  const receivedLabels: CriteriaLabels = isOrderer
    ? {
        technical: { title: "対応・段取り", desc: "" },
        communication: { title: "コミュニケーション", desc: "" },
        reliability: { title: "信頼性", desc: "" },
      }
    : {
        technical: { title: "技術力", desc: "" },
        communication: { title: "コミュニケーション", desc: "" },
        reliability: { title: "信頼性", desc: "" },
      };

  async function handleSubmit() {
    setShowConfirm(false);
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
      // 即時公開: 最新の評価状態を取り直して表示を更新
      const updated = await getOrderDetail(orderId);
      setOrder(updated);
      setSuccessMessage("評価を送信しました");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (!evaluateeCompanyId || !targetName) {
    return (
      <div className="p-4 text-center text-knock-text-muted">
        評価対象の企業情報が取得できませんでした
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#F5F5F5]">
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push(`/orders/${orderId}`)}
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
          {!myEvaluation && (
            <p className="mt-1 text-[15px] font-bold text-knock-text">
              {targetName} 様を評価してください
            </p>
          )}
        </div>

        {/* 自分の評価（未提出ならフォーム / 提出済みなら確認表示） */}
        {myEvaluation ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-knock-text">あなたの評価</span>
              <span className="text-[12px] text-knock-text-secondary">（{targetName} 様へ）</span>
            </div>
            <ScoreCard label={labels.technical} value={myEvaluation.technicalSkill} color={accentColor} />
            <ScoreCard label={labels.communication} value={myEvaluation.communication} color={accentColor} />
            <ScoreCard label={labels.reliability} value={myEvaluation.reliability} color={accentColor} />
            {myEvaluation.comment && (
              <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
                <h3 className="mb-1 text-[13px] font-bold text-knock-text">コメント</h3>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-knock-text-secondary">
                  {myEvaluation.comment}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 技術力 / 対応・段取り */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <h3 className="mb-1 text-[14px] font-bold text-knock-text">{labels.technical.title}</h3>
              <p className="mb-2 text-[12px] text-knock-text-secondary">{labels.technical.desc}</p>
              <StarRating value={technicalSkill} onChange={setTechnicalSkill} color={accentColor} />
            </div>

            {/* コミュニケーション */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <h3 className="mb-1 text-[14px] font-bold text-knock-text">{labels.communication.title}</h3>
              <p className="mb-2 text-[12px] text-knock-text-secondary">{labels.communication.desc}</p>
              <StarRating value={communication} onChange={setCommunication} color={accentColor} />
            </div>

            {/* 信頼性 */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              <h3 className="mb-1 text-[14px] font-bold text-knock-text">{labels.reliability.title}</h3>
              <p className="mb-2 text-[12px] text-knock-text-secondary">{labels.reliability.desc}</p>
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
                if (!evaluateeCompanyId) {
                  alert("評価対象が取得できませんでした");
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
          </>
        )}

        {/* 相手からの評価（すぐ公開） */}
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-knock-text">相手からの評価</span>
            <span className="text-[12px] text-knock-text-secondary">（{targetName} 様より）</span>
          </div>
          {receivedEvaluation ? (
            <>
              <ScoreCard label={receivedLabels.technical} value={receivedEvaluation.technicalSkill} color={accentColor} />
              <ScoreCard label={receivedLabels.communication} value={receivedEvaluation.communication} color={accentColor} />
              <ScoreCard label={receivedLabels.reliability} value={receivedEvaluation.reliability} color={accentColor} />
              {receivedEvaluation.comment && (
                <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
                  <h3 className="mb-1 text-[13px] font-bold text-knock-text">コメント</h3>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-knock-text-secondary">
                    {receivedEvaluation.comment}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl bg-white p-4 text-center text-[13px] text-knock-text-secondary shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
              まだ相手からの評価はありません
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="評価の送信"
        message="評価を送信しますか？送信後は変更できません。"
        confirmLabel={submitting ? "送信中..." : "はい"}
        cancelLabel="いいえ"
        variant="primary"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => setSuccessMessage("")}
        title="完了"
        message={successMessage}
      />
    </div>
  );
}

function ScoreCard({
  label,
  value,
  color,
}: {
  label: { title: string; desc: string };
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-knock-text">{label.title}</h3>
          {label.desc && <p className="text-[12px] text-knock-text-secondary">{label.desc}</p>}
        </div>
        <StarRating value={value} color={color} readonly />
      </div>
    </div>
  );
}
