import { z } from "zod";

export const createOrderSchema = z.object({
  factoryFloorId: z.string().min(1, "現場を選択してください"),
  workCompanyId: z.string().min(1, "施工会社を選択してください"),
  message: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderActionSchema = z.object({
  orderId: z.string().min(1),
  message: z.string().optional(),
});

export type OrderActionInput = z.infer<typeof orderActionSchema>;

export const priceDetailSchema = z.object({
  name: z.string().min(1, "項目名を入力してください"),
  quantity: z.number().min(1, "数量は1以上を入力してください"),
  unitId: z.string().optional(),
  priceUnit: z.number().min(0, "単価は0以上を入力してください"),
  specifications: z.string().optional(),
});

export type PriceDetailInput = z.infer<typeof priceDetailSchema>;
