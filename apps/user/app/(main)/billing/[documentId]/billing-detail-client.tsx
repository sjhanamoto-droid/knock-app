"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/lib/hooks/use-mode";
import { ConfirmDialog, useToast } from "@knock/ui";
import {
  confirmInvoice,
  recalculateInvoice,
  markInvoicePaid,
  getInvoiceOrderRows,
  getAddableOrders,
  rebuildInvoiceFromOrders,
} from "@/lib/actions/invoices";
import { getDocumentDetail } from "@/lib/actions/documents";

type DocDetail = Awaited<ReturnType<typeof getDocumentDetail>>;
type OrderRow = Awaited<ReturnType<typeof getInvoiceOrderRows>>[number];
type AddableRow = Awaited<ReturnType<typeof getAddableOrders>>[number];

// base64 の data URL はブラウザが新規タブで直接開けない(ブロックされる)ため、
// Blob に変換して object URL として開く。通常URLはそのまま開く。
function openPdf(url: string) {
  if (!url.startsWith("data:")) {
    window.open(url, "_blank");
    return;
  }
  try {
    const base64 = url.split(",")[1] ?? "";
    const mime = url.split(",")[0]?.split(":")[1]?.split(";")[0] ?? "application/pdf";
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mime });
    const objectUrl = URL.createObjectURL(blob);
    const opened = window.open(objectUrl, "_blank");
    if (!opened) {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "請求書.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  } catch {
    window.open(url, "_blank");
  }
}

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

interface Props {
  initialDoc: DocDetail;
  documentId: string;
  // 一覧で開いていた月(YYYYMM)。戻るときにこの月へ復元する。
  backYm?: string | null;
}

export function BillingDetailClient({ initialDoc, documentId, backYm }: Props) {
  const router = useRouter();
  // 受注者モード(CONTRACTOR)では請求書を「確認のみ」にするため、発注者向けの操作ボタン
  // （確定・再集計・支払い完了・発注の追加/削除・再作成）は isOrderer のときだけ表示する。
  const { accentColor, isOrderer } = useMode();
  const { toast } = useToast();
  // 一覧で開いていた月(YYYYMM)。詳細内の再作成/再集計・戻る操作で保持する。
  const validYm = backYm && /^\d{6}$/.test(backYm) ? backYm : null;
  const ymQuery = validYm ? `?ym=${validYm}` : "";
  const [doc, setDoc] = useState<DocDetail>(initialDoc);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"confirm" | "paid" | null>(null);

  // 含まれる発注（注文書リンク付き）と、追加/削除のステージング
  const [orderRows, setOrderRows] = useState<OrderRow[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [addedRows, setAddedRows] = useState<OrderRow[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [addable, setAddable] = useState<AddableRow[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    getInvoiceOrderRows(documentId).then(setOrderRows).catch(() => {});
  }, [documentId]);

  async function openPicker() {
    setShowPicker(true);
    setPickerLoading(true);
    try {
      setAddable(await getAddableOrders(documentId));
    } catch {
      toast("追加できる発注の取得に失敗しました");
    } finally {
      setPickerLoading(false);
    }
  }

  function addOrder(row: AddableRow) {
    setAddedRows((prev) =>
      prev.some((r) => r.orderId === row.orderId)
        ? prev
        : [...prev, { orderId: row.orderId, siteName: row.siteName, parentSiteName: row.parentSiteName, siteCode: row.siteCode, documentNumber: "", amount: row.amount, orderSheetPdfUrl: null }]
    );
  }

  function removeCurrent(orderId: string) {
    setRemovedIds((prev) => new Set(prev).add(orderId));
  }
  function restoreCurrent(orderId: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  }
  function removeAdded(orderId: string) {
    setAddedRows((prev) => prev.filter((r) => r.orderId !== orderId));
  }

  async function handleRebuild() {
    const stagedIds = [
      ...orderRows.filter((r) => !removedIds.has(r.orderId)).map((r) => r.orderId),
      ...addedRows.map((r) => r.orderId),
    ];
    if (stagedIds.length === 0) {
      toast("発注を1件以上残してください");
      return;
    }
    setRebuilding(true);
    try {
      const res = await rebuildInvoiceFromOrders(documentId, stagedIds);
      toast("請求書を作り直しました");
      router.replace(`/billing/${res.id}${ymQuery}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setRebuilding(false);
    }
  }

  if (!doc) {
    return <div className="p-4 text-center text-knock-text-muted">請求書が見つかりません</div>;
  }

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
      router.replace(`/billing/${newId}${ymQuery}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setActionLoading(false);
    }
  }

  const sc = statusColors[doc.status] ?? statusColors.VOID;
  const metadata = doc.metadata as Record<string, unknown> | null;
  const lineItems = (metadata?.lineItems as { documentNumber: string; siteName: string; siteCode?: string; amount: number }[]) ?? [];

  // 発注の追加/削除は「確認待ち(DRAFT)」のみ。確定済み(ISSUED)・支払済み・無効は編集不可。
  // さらに発注者モードのみ編集可（受注者モードは確認のみ）。
  const editable = doc.status === "DRAFT";
  const canEdit = editable && isOrderer;
  const currentRows = orderRows.filter((r) => !removedIds.has(r.orderId));
  const addedIds = new Set(addedRows.map((r) => r.orderId));
  const dirty = removedIds.size > 0 || addedRows.length > 0;
  const stagedTotal = [...currentRows, ...addedRows].reduce((s, r) => s + r.amount, 0);

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-32">
      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white px-4 py-3 text-center shadow-sm">
        <button
          onClick={() => (validYm ? router.push(`/billing?ym=${validYm}`) : router.back())}
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

        {/* 含まれる発注 */}
        {(orderRows.length > 0 || lineItems.length > 0) && (
          <div className={cardClass}>
            <p className="text-[13px] font-bold text-[#1A2340] mb-3">含まれる発注</p>

            {orderRows.length > 0 ? (
              <div className="space-y-2">
                {/* 既存の発注（タップで注文書を表示） */}
                {currentRows.map((row) => (
                  <div key={row.orderId} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => (row.orderSheetPdfUrl ? openPdf(row.orderSheetPdfUrl) : toast("注文書が見つかりません"))}
                      className="flex min-w-0 flex-1 items-center justify-between text-left"
                    >
                      <div className="min-w-0">
                        {row.parentSiteName && (
                          <p className="truncate text-[11px] text-knock-text-secondary">現場名: {row.parentSiteName}</p>
                        )}
                        <p className="truncate text-[13px] font-medium text-[#1A2340]">{row.siteName || "─"}</p>
                        <p className="truncate text-[11px] text-knock-text-secondary">
                          {row.siteCode ? `工事番号: ${row.siteCode} / ` : ""}{row.documentNumber || "注文書を表示"}
                        </p>
                      </div>
                      <span className="ml-2 flex shrink-0 items-center gap-1 text-[13px] font-bold text-[#1A2340]">
                        ¥{row.amount.toLocaleString()}
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    </button>
                    {canEdit && (
                      <button type="button" onClick={() => removeCurrent(row.orderId)} className="shrink-0 rounded-full p-1 active:bg-gray-200" aria-label="削除">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" /></svg>
                      </button>
                    )}
                  </div>
                ))}

                {/* 削除予定（復元可能） */}
                {orderRows.filter((r) => removedIds.has(r.orderId)).map((row) => (
                  <div key={row.orderId} className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-red-400 line-through">{row.siteName || "─"}</p>
                      <p className="text-[11px] text-red-300">削除されます</p>
                    </div>
                    <button type="button" onClick={() => restoreCurrent(row.orderId)} className="shrink-0 text-[12px] font-bold text-[#1A2340]">戻す</button>
                  </div>
                ))}

                {/* 追加した発注 */}
                {addedRows.map((row) => (
                  <div key={row.orderId} className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      {row.parentSiteName && (
                        <p className="truncate text-[11px] text-knock-text-secondary">現場名: {row.parentSiteName}</p>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white">追加</span>
                        <p className="truncate text-[13px] font-medium text-[#1A2340]">{row.siteName || "─"}</p>
                      </div>
                      {row.siteCode && <p className="text-[11px] text-knock-text-secondary">工事番号: {row.siteCode}</p>}
                    </div>
                    <span className="shrink-0 text-[13px] font-bold text-[#1A2340]">¥{row.amount.toLocaleString()}</span>
                    <button type="button" onClick={() => removeAdded(row.orderId)} className="shrink-0 rounded-full p-1 active:bg-gray-200" aria-label="取り消し">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* 旧データ（発注ID未保持）の読み取り専用表示 */
              <div className="space-y-2">
                {lineItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-[#1A2340]">{item.siteName || "─"}</p>
                      <p className="text-[11px] text-knock-text-secondary">
                        {item.siteCode ? `工事番号: ${item.siteCode} / ` : ""}{item.documentNumber}
                      </p>
                    </div>
                    <p className="text-[13px] font-bold text-[#1A2340]">¥{item.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 発注を追加する */}
            {canEdit && orderRows.length > 0 && (
              <button
                type="button"
                onClick={openPicker}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-2.5 text-[13px] font-bold transition-all active:scale-[0.98]"
                style={{ borderColor: accentColor, color: accentColor }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                発注を追加する
              </button>
            )}

            {/* 追加/削除がある場合のみ、請求書を作り直す */}
            {canEdit && dirty && (
              <button
                type="button"
                onClick={handleRebuild}
                disabled={rebuilding}
                className="mt-2 w-full rounded-xl py-3 text-[14px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {rebuilding ? "作成中..." : `変更を反映して請求書を再作成する（¥${stagedTotal.toLocaleString()}）`}
              </button>
            )}
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
          <button
            type="button"
            onClick={() => openPdf(doc.pdfUrl!)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-[13px] font-bold text-gray-600 transition-all active:scale-[0.98]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 12L8 8L12 12M8 8V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180 8 7)" />
              <path d="M2 14H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            PDFを表示
          </button>
        )}

        {/* アクションボタン（発注者モードのみ。受注者は確認のみ） */}
        {doc.status === "DRAFT" && isOrderer && (
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

        {doc.status === "ISSUED" && isOrderer && (
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

      {/* 発注の追加ピッカー */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowPicker(false)}>
          <div className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[15px] font-bold text-[#1A2340]">発注を追加</p>
              <button onClick={() => setShowPicker(false)} className="text-[13px] font-bold text-gray-400">閉じる</button>
            </div>
            <p className="mb-3 text-[12px] text-knock-text-secondary">この取引先の締め完了・未請求の発注から選択できます。</p>
            {pickerLoading ? (
              <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" /></div>
            ) : addable.filter((a) => !addedIds.has(a.orderId)).length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-6 text-center text-[13px] text-gray-400">追加できる発注はありません</div>
            ) : (
              <div className="space-y-2">
                {addable.filter((a) => !addedIds.has(a.orderId)).map((a) => (
                  <button
                    key={a.orderId}
                    onClick={() => addOrder(a)}
                    className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-3 py-3 text-left transition-all active:scale-[0.98]"
                  >
                    <div className="min-w-0">
                      {a.parentSiteName && (
                        <p className="truncate text-[11px] text-knock-text-secondary">現場名: {a.parentSiteName}</p>
                      )}
                      <p className="truncate text-[13px] font-medium text-[#1A2340]">{a.siteName || "─"}</p>
                      <p className="truncate text-[11px] text-knock-text-secondary">
                        {a.siteCode ? `工事番号: ${a.siteCode} / ` : ""}{a.completedDay ? `締め: ${new Date(a.completedDay).toLocaleDateString("ja-JP")}` : ""}
                      </p>
                    </div>
                    <span className="ml-2 flex shrink-0 items-center gap-1 text-[13px] font-bold" style={{ color: accentColor }}>
                      ¥{a.amount.toLocaleString()}
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
