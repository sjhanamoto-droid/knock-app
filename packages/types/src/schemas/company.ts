import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1, "企業名を入力してください"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  nameKana: z.string().optional(),
  invoiceNumber: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  streetAddress: z.string().optional(),
  building: z.string().optional(),
  telNumber: z.string().optional(),
  hpUrl: z.string().url().optional().or(z.literal("")),
  companyForm: z.enum(["CORPORATION", "INDIVIDUAL"]),
  type: z.enum(["ORDERER", "CONTRACTOR", "BOTH"]),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
