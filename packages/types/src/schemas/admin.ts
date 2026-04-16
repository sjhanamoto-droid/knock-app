import { z } from "zod";

export const createAdminUserSchema = z.object({
  lastName: z.string().min(1, "姓を入力してください"),
  firstName: z.string().min(1, "名を入力してください"),
  lastNameKana: z.string().optional(),
  firstNameKana: z.string().optional(),
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  telNumber: z.string().optional(),
  roleId: z.number().default(1),
});

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;

export const updateAdminUserSchema = createAdminUserSchema
  .omit({ password: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

export const updateAdminCompanySchema = z.object({
  name: z.string().min(1, "企業名を入力してください").optional(),
  email: z.string().email("有効なメールアドレスを入力してください").optional(),
  nameKana: z.string().optional(),
  invoiceNumber: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  streetAddress: z.string().optional(),
  building: z.string().optional(),
  telNumber: z.string().optional(),
  hpUrl: z.string().optional(),
  bankName: z.string().optional(),
  bankBranchName: z.string().optional(),
  bankAccountType: z.enum(["ORDINARY", "CURRENT"]).optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
});

export type UpdateAdminCompanyInput = z.infer<typeof updateAdminCompanySchema>;

export const contractMasterSchema = z.object({
  name: z.string().min(1, "プラン名を入力してください"),
  type: z.number(),
  form: z.string(),
  numberOfAccount: z.number().min(1, "アカウント数は1以上を入力してください"),
  price: z.number().min(0, "金額は0以上を入力してください"),
  note: z.string().optional(),
});

export type ContractMasterInput = z.infer<typeof contractMasterSchema>;
