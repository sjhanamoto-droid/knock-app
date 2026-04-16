import { z } from "zod";

export const createMemberSchema = z.object({
  lastName: z.string().min(1, "姓を入力してください"),
  firstName: z.string().min(1, "名を入力してください"),
  lastNameKana: z.string().optional(),
  firstNameKana: z.string().optional(),
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  telNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  role: z.enum(["REPRESENTATIVE", "MANAGER", "OTHER"]).default("OTHER"),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  lastName: z.string().min(1, "姓を入力してください").optional(),
  firstName: z.string().min(1, "名を入力してください").optional(),
  lastNameKana: z.string().optional(),
  firstNameKana: z.string().optional(),
  email: z.string().email("有効なメールアドレスを入力してください").optional(),
  telNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  role: z.enum(["REPRESENTATIVE", "MANAGER", "OTHER"]).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
