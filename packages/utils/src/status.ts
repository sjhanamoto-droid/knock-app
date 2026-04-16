export const factoryFloorStatusLabels: Record<string, string> = {
  DRAFT: "下書き",
  NOT_ORDERED: "未発注",
  ORDERED: "発注済",
  ORDER_REQUESTED: "発注依頼中",
  CONFIRMED: "確定",
  IN_PROGRESS: "施工中",
  INSPECTION: "検収中",
  COMPLETED: "完了",
  DELIVERY_APPROVED: "納品承認",
  INVOICED: "請求済",
  DEAL_COMPLETED: "取引完了",
};

export const factoryFloorStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  NOT_ORDERED: "bg-amber-100 text-amber-700",
  ORDERED: "bg-blue-100 text-blue-700",
  ORDER_REQUESTED: "bg-purple-100 text-purple-700",
  CONFIRMED: "bg-cyan-100 text-cyan-700",
  IN_PROGRESS: "bg-emerald-100 text-emerald-700",
  INSPECTION: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-gray-200 text-gray-700",
  DELIVERY_APPROVED: "bg-teal-100 text-teal-700",
  INVOICED: "bg-indigo-100 text-indigo-700",
  DEAL_COMPLETED: "bg-slate-200 text-slate-800",
};

export const orderStatusLabels: Record<string, string> = {
  PENDING: "承認待ち",
  APPROVED: "承認済",
  REJECTED: "却下",
  CANCELLED: "キャンセル",
  CONFIRMED: "確定",
};

export const orderStatusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
  CONFIRMED: "bg-blue-100 text-blue-700",
};

export const billingStatusLabels: Record<string, string> = {
  DRAFT: "下書き",
  PENDING: "承認待ち",
  APPROVED: "承認済",
  REJECTED: "却下",
};

export const billingStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export const chatRoomStatusLabels: Record<string, string> = {
  OPEN: "オープン",
  BLOCKED: "ブロック",
  COMPLETED: "完了",
};

export const companyTypeLabels: Record<string, string> = {
  ORDERER: "発注者",
  CONTRACTOR: "受注者",
  BOTH: "発注者・受注者",
};

export const userRoleLabels: Record<string, string> = {
  REPRESENTATIVE: "代表者",
  MANAGER: "管理者",
  OTHER: "一般",
};

export const contractStatusLabels: Record<string, string> = {
  UNSENT: "未送付",
  SENT: "送付済",
  CONCLUDED: "締結済",
  DRAFT: "下書き",
};

export const paymentStatusLabels: Record<string, string> = {
  UNPAID: "未払い",
  PAID: "支払い済",
};

// ============ V2 ステータス ============

export const documentTypeLabels: Record<string, string> = {
  ORDER_SHEET: "注文書",
  DELIVERY_NOTE: "納品書",
  INVOICE: "請求書",
};

export const documentTypeIcons: Record<string, string> = {
  ORDER_SHEET: "📋",
  DELIVERY_NOTE: "📦",
  INVOICE: "💴",
};

export const documentStatusLabels: Record<string, string> = {
  DRAFT: "下書き",
  ISSUED: "発行済",
  CONFIRMED: "確認済",
  VOID: "無効",
};

export const documentStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ISSUED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  VOID: "bg-red-100 text-red-700",
};

export const jobPostingStatusLabels: Record<string, string> = {
  DRAFT: "下書き",
  PUBLISHED: "公開中",
  CLOSED: "締切",
  FILLED: "採用済",
};

export const jobPostingStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-amber-100 text-amber-700",
  FILLED: "bg-blue-100 text-blue-700",
};

export const applicationStatusLabels: Record<string, string> = {
  PENDING: "審査中",
  ACCEPTED: "採用",
  REJECTED: "不採用",
  WITHDRAWN: "取下げ",
};

export const applicationStatusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  WITHDRAWN: "bg-gray-100 text-gray-600",
};

export const availabilityStatusLabels: Record<string, string> = {
  AVAILABLE: "空き",
  BUSY: "予定あり",
  NEGOTIABLE: "応相談",
};

export const availabilityStatusColors: Record<string, string> = {
  AVAILABLE: "bg-green-500",
  BUSY: "bg-red-500",
  NEGOTIABLE: "bg-yellow-500",
};

export const verificationLevelLabels: Record<string, string> = {
  LEVEL_1: "メール認証済",
  LEVEL_2: "本人確認済",
  LEVEL_3: "インボイス確認済",
};

/** @deprecated DAILY/LUMP_SUM区分は廃止。UIでは使用しない。 */
export const compensationTypeLabels: Record<string, string> = {
  DAILY: "日額",
  LUMP_SUM: "一式",
  NEGOTIABLE: "応相談",
};
