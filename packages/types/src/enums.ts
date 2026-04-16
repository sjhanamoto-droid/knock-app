export const CompanyType = {
  ORDERER: "ORDERER",
  CONTRACTOR: "CONTRACTOR",
  BOTH: "BOTH",
} as const;
export type CompanyType = (typeof CompanyType)[keyof typeof CompanyType];

export const CompanyForm = {
  CORPORATION: "CORPORATION",
  INDIVIDUAL: "INDIVIDUAL",
} as const;
export type CompanyForm = (typeof CompanyForm)[keyof typeof CompanyForm];

export const UserRole = {
  REPRESENTATIVE: "REPRESENTATIVE",
  MANAGER: "MANAGER",
  OTHER: "OTHER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const FactoryFloorStatus = {
  DRAFT: "DRAFT",
  NOT_ORDERED: "NOT_ORDERED",
  ORDERED: "ORDERED",
  ORDER_REQUESTED: "ORDER_REQUESTED",
  CONFIRMED: "CONFIRMED",
  IN_PROGRESS: "IN_PROGRESS",
  INSPECTION: "INSPECTION",
  COMPLETED: "COMPLETED",
  DELIVERY_APPROVED: "DELIVERY_APPROVED",
  INVOICED: "INVOICED",
  DEAL_COMPLETED: "DEAL_COMPLETED",
} as const;
export type FactoryFloorStatus = (typeof FactoryFloorStatus)[keyof typeof FactoryFloorStatus];

export const ChatRoomType = {
  NEGOTIATION: "NEGOTIATION",
  SITE_INFO: "SITE_INFO",
} as const;
export type ChatRoomType = (typeof ChatRoomType)[keyof typeof ChatRoomType];

export const MessageType = {
  TEXT: "TEXT",
  FILE: "FILE",
  ACTION: "ACTION",
  CONFIRM: "CONFIRM",
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const NotificationType = {
  ORDER_REQUEST: 1,
  INSPECTION_APPROVAL: 2,
  PAYMENT_CONFIRM_REQUEST: 3,
  BILLING_APPROVAL: 4,
  CONTRACTOR_CANCEL: 5,
  CONTRACTOR_STOP: 6,
  CONTRACTOR_BILLING_REJECT: 7,
  ORDER_CREATED: 8,
  ORDER_CANCEL_NOTICE: 9,
  ORDER_CONFIRMED: 10,
  ORDERER_STOP: 11,
  REPORT_CONFIRM: 12,
  ORDER_CANCEL: 13,
  SITE_MEMBER_ADDED: 14,
  SITE_MEMBER_REMOVED: 15,
  REPORT_REJECT: 16,
  MATCHING_REQUEST: 17,
  MATCHING_CONFIRM: 18,
  MATCHING_REJECT: 19,
  // V2: 新規通知タイプ
  JOB_APPLICATION: 20,
  JOB_APPLICATION_ACCEPTED: 21,
  JOB_APPLICATION_REJECTED: 22,
  EVALUATION_RECEIVED: 23,
  DOCUMENT_GENERATED: 24,
  VERIFICATION_COMPLETED: 25,
  COMPLETION_REPORT: 26,
  DELIVERY_APPROVAL: 27,
  INVOICE_GENERATED: 28,
  ORDER_CONFIRMED_V2: 29,
  DELIVERY_APPROVED: 30,
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

// ============ V2 Enums ============

export const VerificationLevel = {
  LEVEL_1: "LEVEL_1",
  LEVEL_2: "LEVEL_2",
  LEVEL_3: "LEVEL_3",
} as const;
export type VerificationLevel = (typeof VerificationLevel)[keyof typeof VerificationLevel];

export const AvailabilityStatus = {
  AVAILABLE: "AVAILABLE",
  BUSY: "BUSY",
  NEGOTIABLE: "NEGOTIABLE",
} as const;
export type AvailabilityStatus = (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

export const DocumentType = {
  ORDER_SHEET: "ORDER_SHEET",
  DELIVERY_NOTE: "DELIVERY_NOTE",
  INVOICE: "INVOICE",
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentStatus = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  CONFIRMED: "CONFIRMED",
  VOID: "VOID",
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const JobPostingStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  CLOSED: "CLOSED",
  FILLED: "FILLED",
} as const;
export type JobPostingStatus = (typeof JobPostingStatus)[keyof typeof JobPostingStatus];

export const ApplicationStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

/** @deprecated DAILY/LUMP_SUM区分は廃止。UIでは使用しない。スキーマ互換のため維持。 */
export const CompensationType = {
  DAILY: "DAILY",
  LUMP_SUM: "LUMP_SUM",
  NEGOTIABLE: "NEGOTIABLE",
} as const;
export type CompensationType = (typeof CompensationType)[keyof typeof CompensationType];
