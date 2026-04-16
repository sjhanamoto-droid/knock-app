import { z } from "zod";

export const createUserSchema = z.object({
  lastName: z.string().min(1, "姓を入力してください"),
  firstName: z.string().min(1, "名を入力してください"),
  lastNameKana: z.string().min(1, "姓（カナ）を入力してください"),
  firstNameKana: z.string().min(1, "名（カナ）を入力してください"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  telNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
