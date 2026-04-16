import { z } from "zod";

export const createBillingSchema = z.object({
  factoryFloorOrderId: z.string().min(1),
  roomId: z.string().min(1),
  remark: z.string().optional(),
  details: z.array(
    z.object({
      name: z.string().min(1, "項目名を入力してください"),
      quantity: z.number().min(1),
      unitId: z.string().optional(),
      priceUnit: z.number().min(0),
      specifications: z.string().optional(),
      priceOrderDetailId: z.string().optional(),
    })
  ).min(1, "明細を1つ以上入力してください"),
});

export type CreateBillingInput = z.infer<typeof createBillingSchema>;

export const billingActionSchema = z.object({
  billingId: z.string().min(1),
  remark: z.string().optional(),
});

export type BillingActionInput = z.infer<typeof billingActionSchema>;
