import { z } from "zod";

export const registrationStep1Schema = z
  .object({
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z.string().min(8, "パスワードは8文字以上で入力してください"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });

export type RegistrationStep1Input = z.infer<typeof registrationStep1Schema>;

export const registrationStep2Schema = z.object({
  companyForm: z.enum(["CORPORATION", "INDIVIDUAL"], {
    errorMap: () => ({ message: "会社形態を選択してください" }),
  }),
  businessName: z.string().min(1, "会社名または屋号を入力してください"),
  nameKana: z.string().min(1, "会社名または屋号（カナ）を入力してください"),
  postalCode: z.string().min(1, "郵便番号を入力してください"),
  prefecture: z.string().min(1, "都道府県を入力してください"),
  city: z.string().min(1, "市区町村を入力してください"),
  streetAddress: z.string().min(1, "番地を入力してください"),
  building: z.string().optional(),
  telNumber: z.string().min(1, "電話番号を入力してください"),
  invoiceNumber: z.string().optional(),
});

export type RegistrationStep2Input = z.infer<typeof registrationStep2Schema>;

export const registrationStep3Schema = z.object({
  lastName: z.string().min(1, "姓を入力してください"),
  firstName: z.string().min(1, "名を入力してください"),
  lastNameKana: z.string().min(1, "姓（カナ）を入力してください"),
  firstNameKana: z.string().min(1, "名（カナ）を入力してください"),
  dateOfBirth: z.string().min(1, "生年月日を入力してください"),
  telPhone: z.string().min(1, "電話番号を入力してください"),
});

export type RegistrationStep3Input = z.infer<typeof registrationStep3Schema>;
