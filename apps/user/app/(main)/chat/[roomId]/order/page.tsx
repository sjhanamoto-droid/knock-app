"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSite } from "@/lib/actions/sites";
import { getChatRoom } from "@/lib/actions/chat";
import { createOrderRequest } from "@/lib/actions/orders";
import { getTemplates } from "@/lib/actions/templates";
import { ConfirmDialog, AlertDialog, useToast } from "@knock/ui";

type SiteData = NonNullable<Awaited<ReturnType<typeof getSite>>>;
type TemplateData = Awaited<ReturnType<typeof getTemplates>>;

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "未設定";
  const date = typeof d === "string" ? new Date(d) : d;
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}(${dayNames[date.getDay()]})`;
}

export default function ChatOrderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const roomId = params.roomId as string;
  const siteId = searchParams.get("siteId");
  const companyId = searchParams.get("companyId");

  const [site, setSite] = useState<SiteData | null>(null);
  const [templates, setTemplates] = useState<TemplateData>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    Promise.all([getSite(siteId), getTemplates(), getChatRoom(roomId)]).then(
      ([siteData, templateData, chatData]) => {
        setSite(siteData);
        setTemplates(templateData);
        const name =
          chatData.myCompanyId === chatData.room.orderCompany.id
            ? chatData.room.workerCompany.name
            : chatData.room.orderCompany.name;
        setPartnerName(name ?? "");
      }
    ).finally(() => setLoading(false));
  }, [siteId, roomId]);

  async function handleSubmit() {
    if (!site || !companyId) return;
    setSubmitting(true);
    setError("");
    try {
      await createOrderRequest({
        factoryFloorId: site.id,
        workCompanyId: companyId,
        message: message.trim() || undefined,
      });
      setSuccessMessage("発注依頼を送信しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
      </div>
    );
  }

  if (!siteId || !companyId) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <span className="text-[14px] text-gray-400">
          パラメータが不足しています
        </span>
        <button
          onClick={() => router.back()}
          className="text-[13px] font-semibold text-knock-blue"
        >
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      {/* Header — V1: ← centered 発注依頼 */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="relative flex items-center justify-center px-4 py-3">
          <button
            onClick={() => router.back()}
            className="absolute left-4 flex h-10 w-10 items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 5L8 12L15 19" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[17px] font-bold text-knock-text">発注依頼</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col px-5 pt-6 pb-8">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              {error}
            </div>
          )}

          {/* Partner company header — V1: centered name + instruction */}
          <div className="mb-6 text-center">
            <p className="text-[17px] font-bold text-knock-text">
              {partnerName}　様
            </p>
            <p className="mt-1.5 text-[14px] text-knock-text-secondary">
              現場名を選択して、発注依頼をしてください。
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* 工事名 — V1: label left, value+arrow right */}
          <button
            onClick={() =>
              router.push(
                `/chat/${roomId}/select-site?companyId=${companyId}`
              )
            }
            className="flex items-center justify-between border-b border-gray-200 py-4"
          >
            <span className="text-[15px] font-medium text-knock-text">
              工事名
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[15px] text-knock-text">
                {site?.name ?? "現場を選択"}
              </span>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M7 4L12 9L7 14" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>

          {/* 工期 — V1: two date boxes with calendar icons */}
          <div className="border-b border-gray-200 py-4">
            <p className="mb-3 text-[15px] font-medium text-knock-text">工期</p>
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 text-gray-400">
                  <rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <path d="M2 7H16M5.5 1V4M12.5 1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span className="text-[13px] text-knock-text">
                  {site ? fmtDate(site.startDayRequest) : "xxxx/xx/xx"}
                </span>
              </div>
              <span className="text-[15px] text-gray-400">~</span>
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 text-gray-400">
                  <rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <path d="M2 7H16M5.5 1V4M12.5 1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span className="text-[13px] text-knock-text">
                  {site ? fmtDate(site.endDayRequest) : "xxxx/xx/xx"}
                </span>
              </div>
            </div>
          </div>

          {/* 受注期限 — V1 specific field */}
          <div className="border-b border-gray-200 py-4">
            <p className="mb-3 text-[15px] font-medium text-knock-text">
              受注期限
            </p>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-[14px] text-knock-text focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* メッセージ — V1: label + テンプレートを使う button */}
          <div className="py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-medium text-knock-text">
                メッセージ
              </p>
              <button
                onClick={() => setShowTemplates(true)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px] font-medium text-knock-text active:bg-gray-50"
              >
                テンプレートを使う
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="発注に関するメッセージを入力..."
              className="w-full rounded-lg border border-gray-200 bg-[#F8F9F0] px-4 py-3 text-[14px] leading-relaxed text-knock-text placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Submit button — V1: orange, full width, rounded */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!site || submitting}
            className="mt-4 w-full rounded-xl bg-knock-orange py-4 text-[17px] font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? "送信中..." : "発注する"}
          </button>
        </div>
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSubmit}
        title="発注依頼を送信"
        message={`${partnerName} に「${site?.name}」の発注依頼を送信します。よろしいですか？`}
        confirmLabel={submitting ? "送信中..." : "送信する"}
        cancelLabel="キャンセル"
        variant="primary"
      />
      <AlertDialog
        open={!!successMessage}
        onClose={() => {
          setSuccessMessage("");
          router.replace(`/chat/${roomId}`);
        }}
        title="完了"
        message={successMessage}
      />

      {/* Template modal — V1 style: full page list */}
      {showTemplates && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowTemplates(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom,16px)]">
            {/* Header */}
            <div className="sticky top-0 border-b border-gray-200 bg-white">
              <div className="relative flex items-center justify-center px-4 py-3">
                <button
                  onClick={() => setShowTemplates(false)}
                  className="absolute left-4 flex h-8 w-8 items-center justify-center"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M13 4L7 10L13 16" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <h2 className="text-[16px] font-bold text-knock-text">
                  テンプレート
                </h2>
              </div>
            </div>

            {/* Template list — V1 style */}
            <div className="flex flex-col">
              {templates.length === 0 ? (
                <p className="py-12 text-center text-[14px] text-gray-400">
                  テンプレートがありません
                </p>
              ) : (
                templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setMessage(tpl.content ?? "");
                      setShowTemplates(false);
                    }}
                    className="border-b border-gray-200 px-5 py-4 text-left transition-colors active:bg-gray-50"
                  >
                    <p className="text-[15px] font-bold text-knock-text">
                      {tpl.name}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-knock-text-secondary">
                      {tpl.content}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
