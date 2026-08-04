import { z } from "zod";

// ============ Sub-schemas ============

export const priceOrderDetailSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "項目名を入力してください"),
  quantity: z.coerce.number().min(0.1, "数量は0.1以上にしてください"),
  unitId: z.string().optional(),
  // マイナスハッチ（値引き行）に対応するため負値も許可
  priceUnit: z.coerce.number().int(),
  specifications: z.string().optional(),
});

export type PriceOrderDetailInput = z.infer<typeof priceOrderDetailSchema>;

export const occupationSelectionSchema = z.object({
  occupationSubItemId: z.string(),
  note: z.string().optional(),
});

export type OccupationSelectionInput = z.infer<typeof occupationSelectionSchema>;

// 追加発注予算（親プロジェクトの予算内訳・複数行）。金額は税抜。
export const additionalBudgetSchema = z.object({
  name: z.string().optional().default(""),
  amount: z.coerce.number().int(),
});

export type AdditionalBudgetInput = z.infer<typeof additionalBudgetSchema>;

// ============ Main schemas ============

export const createFactoryFloorSchema = z.object({
  // 親子関係
  parentId: z.string().optional(),
  // 工事発注予算（税抜）
  budget: z.coerce.number().int().min(0).optional().or(z.literal("")),
  // 追加発注予算（税抜・複数行）。全体予算＝budget＋Σamount
  additionalBudgets: z.array(additionalBudgetSchema).optional().default([]),

  // 基本情報
  name: z.string().min(1, "現場名を入力してください"),
  code: z.string().optional(),
  contentRequest: z.string().optional(),
  remarks: z.string().optional(),

  // 場所情報
  address: z.string().optional(),
  deliveryDest: z.string().optional(),

  // 日程
  startDayRequest: z.string().optional(),
  endDayRequest: z.string().optional(),

  // 金額
  totalAmount: z.coerce.number().int().min(0).optional().or(z.literal("")),
  totalAdvancePayment: z.coerce.number().int().min(0).optional().or(z.literal("")),
  expenses: z.coerce.number().int().min(0).optional().or(z.literal("")),

  // 支払条件
  paymentType: z.coerce.number().int().optional().or(z.literal("")),
  paymentLatterMonth: z.coerce.number().int().min(0).optional().or(z.literal("")),
  paymentLatterDay: z.coerce.number().int().min(1).max(31).optional().or(z.literal("")),

  // 工種
  occupations: z.array(occupationSelectionSchema).optional().default([]),

  // 明細
  priceDetails: z.array(priceOrderDetailSchema).optional().default([]),
});

export type CreateFactoryFloorInput = z.infer<typeof createFactoryFloorSchema>;

export const updateFactoryFloorSchema = createFactoryFloorSchema.partial().extend({
  deletedPriceDetailIds: z.array(z.string()).optional(),
  deletedImageIds: z.array(z.string()).optional(),
  deletedPdfIds: z.array(z.string()).optional(),
});

export type UpdateFactoryFloorInput = z.infer<typeof updateFactoryFloorSchema>;

// ============ Filter schema ============

export const factoryFloorFilterSchema = z.object({
  status: z.enum([
    "DRAFT", "NOT_ORDERED", "ORDERED", "ORDER_REQUESTED",
    "CONFIRMED", "IN_PROGRESS", "INSPECTION", "COMPLETED",
  ]).optional(),
  search: z.string().optional(),
});

export type FactoryFloorFilter = z.infer<typeof factoryFloorFilterSchema>;
