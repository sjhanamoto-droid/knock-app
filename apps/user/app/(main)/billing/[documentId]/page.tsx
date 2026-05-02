"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { ConfirmDialog, useToast } from "@knock/ui";
import {
  confirmInvoice,
  recalculateInvoice,
  markInvoicePaid,
} from "@/lib/actions/invoices";
import { getDocumentDetail } from "@/lib/actions/documents";

type DocDetail = Awaited<ReturnType<typeof getDocumentDetail>>;

const statusLabels: Record<string, string> = {
  DRAFT: "確認待ち",
  ISSUED: "確定済み",
  CONFIRMED: "支払済み",
  VOID: "無効",
};

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "#FEF3C7", text: "#92400E" },
  ISSUED: { bg: "#DBEAFE", text: "#1E40AF" },
  CONFIRMED: { bg: "#D1FAE5", text: "#065F46" },
  VOID: { bg: "#F3F4F6", text: "#6B7280" },
};

function WavyUnderline({ color }: { color: string }) {
  return (
    <svg width="40" height="6" viewBox="0 0 40 6" fill="none">
      <path d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const cardClass = "rounded-2xl bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]";
const labelClass = "text-[12px] text-knock-text-secondary";

export default function BillingDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const router = useRouter();
  const { accentColor } = useMode();
  const { toast } = useToast();
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"confirm" | "paid" | null>(null);

  useEffect(() => {
    getDocumentDetail(documentId)
      .then(setDoc)
      .catch(() => toast("請求書の取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [documentId]);

  async function handleConfirm() {
    setActionLoading(true);
    try {
      await confirmInvoice(documentId);
      toast("請求書を確定しました");
      const updated = await getDocumentDetail(documentId);
      setDoc(updated);
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  async function handlePaid() {
    setActionLoading(true);
    try {
      await markInvoicePaid(documentId);
      toast("支払い完了を記録しました");
      const updated = await getDocumentDetail(documentId);
      setDoc(updated);
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  async function handleRecalculate() {
    setActionLoading(true);
    try {
      const newId = await recalculateInvoice(documentId);
      toast("再集計しました");
      router.replace(`/billing/${newId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!doc) {
    return <div className="p-4 text-center text-knock-text-muted">請求書が見つかりません</div>;
  }

  const sc = statusColors[doc.status] ?? statusColors.VOID;
  const metadata = doc.metadata as Record<string, unknown> | null;
  const lineItems = (metadata?.lineItems as { documentNumber: string; siteName: string; amount: number }[]) ?? [];

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-32">
      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white px-4 py-3 text-center shadow-sm">
        <button
          onClick={() => router.back()}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-1"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="#1A2340" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-[16px] font-bold text-[#1A2340]">請求書詳細</h1>
        <div className="flex justify-center mt-1">
          <WavyUnderline color={accentColor} />
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* ステータスバナー */}
        <div
          className="rounded-xl px-4 py-3 text-center text-[14px] font-bold"
          style={{ backgroundColor: sc.bg, color: sc.text }}
        >
          {statusLabels[doc.status] ?? doc.status}
          {doc.autoConfirmedAt && " （自動確定）"}
        </div>

        {/* 基本情報 */}
        <div className={cardClass}>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className={labelClass}>帳票番号</span>
              <span className="text-[13px] text-[#1A2340]">{doc.documentNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className={labelClass}>対象月</span>
              <span className="text-[13px] text-[#1A2340]">
                {doc.yearMonth ? `${doc.yearMonth.substring(0, 4)}年${parseInt(doc.yearMonth.substring(4))}月` : "─"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={labelClass}>発注者</span>
              <span className="text-[13px] text-[#1A2340]">{doc.orderCompany?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className={labelClass}>受注者</span>
              <span className="text-[13px] text-[#1A2340]">{doc.workerCompany?.name}</span>
            </div>
            {doc.dueDate && (
              <div className="flex justify-between">
                <span className={labelClass}>支払期日</span>
                <span className="text-[13px] text-[#1A2340]">
                  {new Date(doc.dueDate).toLocaleDateString("ja-JP")}
                </span>
              </div>
            )}
            {doc.issuedAt && (
              <div className="flex justify-between">
                <span className={labelClass}>発行日</span>
                <span className="text-[13px] text-[#1A2340]">
                  {new Date(doc.issuedAt).toLocaleDateString("ja-JP")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 納品書明細 */}
        {lineItems.length > 0 && (
          <div className={cardClass}>
            <p className="text-[13px] font-bold text-[#1A2340] mb-3">含まれる納品書</p>
            <div className="space-y-2">
              {lineItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-[#1A2340]">{item.siteName || "─"}</p>
                    <p className="text-[11px] text-knock-text-secondary">{item.documentNumber}</p>
                  </div>
                  <p className="text-[13px] font-bold text-[#1A2340]">
                    ¥{item.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 金額 */}
        <div className={cardClass}>
          <p className="text-[13px] font-bold text-[#1A2340] mb-3">金額</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className={labelClass}>小計</span>
              <span className="text-[13px] text-[#1A2340]">¥{(doc.subtotal ? Number(doc.subtotal) : 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className={labelClass}>消費税（10%）</span>
              <span className="text-[13px] text-[#1A2340]">¥{(doc.taxAmount ? Number(doc.taxAmount) : 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-[14px] font-bold text-[#1A2340]">合計</span>
              <span className="text-[18px] font-bold" style={{ color: accentColor }}>
                ¥{(doc.totalAmount ? Number(doc.totalAmount) : 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* PDF表示 */}
        {doc.pdfUrl && (
          <a
            href={doc.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-[13px] font-bold text-gray-600 transition-all active:scale-[0.98]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 12L8 8L12 12M8 8V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180 8 7)" />
              <path d="M2 14H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            PDFを表示
          </a>
        )}

        {/* アクションボタン */}
        {doc.status === "DRAFT" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setConfirmAction("confirm")}
              disabled={actionLoading}
              className="w-full rounded-xl py-3.5 text-[14px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              請求書を確定する
            </button>
            <button
              onClick={handleRecalculate}
              disabled={actionLoading}
              className="w-full rounded-xl border border-gray-300 py-3.5 text-[14px] font-bold text-gray-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {actionLoading ? "処理中..." : "再集計する"}
            </button>
          </div>
        )}

        {doc.status === "ISSUED" && (
          <button
            onClick={() => setConfirmAction("paid")}
            disabled={actionLoading}
            className="w-full rounded-xl py-3.5 text-[14px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: "#059669" }}
          >
            支払い完了
          </button>
        )}
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction === "confirm" ? handleConfirm : handlePaid}
        title={confirmAction === "confirm" ? "請求書確定の確認" : "支払い完了の確認"}
        message={
          confirmAction === "confirm"
            ? "この請求書を確定します。確定後は再集計できません。よろしいですか？"
            : "支払い完了を記録します。よろしいですか？"
        }
        confirmLabel={confirmAction === "confirm" ? "確定する" : "支払い完了"}
      />
    </div>
  );
}
