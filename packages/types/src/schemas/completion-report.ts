import { z } from "zod";

export const submitCompletionReportSchema = z.object({
  factoryFloorOrderId: z.string().min(1),
  completionDate: z.string().min(1, "施工完了日を入力してください"),
  comment: z.string().optional(),
  photos: z.array(z.string()).min(1, "施工写真を1枚以上添付してください"),
  hasAdditionalWork: z.boolean().default(false),
  additionalWorkDescription: z.string().optional(),
  additionalWorkAmount: z.number().min(0).optional(),
});

export type SubmitCompletionReportInput = z.infer<typeof submitCompletionReportSchema>;

export const inspectionSchema = z.object({
  factoryFloorOrderId: z.string().min(1),
  additionalExpenses: z.array(z.object({
    name: z.string().min(1),
    amount: z.number(),
  })).optional(),
  deductions: z.array(z.object({
    name: z.string().min(1),
    amount: z.number(),
  })).optional(),
  finalAmount: z.number().min(0, "納品金額は0以上を入力してください"),
});

export type InspectionInput = z.infer<typeof inspectionSchema>;
