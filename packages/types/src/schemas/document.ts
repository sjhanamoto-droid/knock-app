import { z } from "zod";

export const documentFilterSchema = z.object({
  type: z.enum(["ORDER_SHEET", "DELIVERY_NOTE", "INVOICE"]).optional(),
  yearMonth: z.string().regex(/^\d{6}$/, "YYYYMM形式で指定してください").optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
});

export type DocumentFilterInput = z.infer<typeof documentFilterSchema>;
