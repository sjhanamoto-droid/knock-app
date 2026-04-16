import { z } from "zod";

export const createJobPostingSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください"),
  factoryFloorId: z.string().optional(),
  occupationSubItemId: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  requireInvoice: z.boolean().default(false),
  requireExperienceYears: z.number().min(0).optional(),
  compensationType: z.enum(["DAILY", "LUMP_SUM", "NEGOTIABLE"]).default("NEGOTIABLE"),
  compensationAmount: z.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  address: z.string().optional(),
  images: z.array(z.string()).optional(),
});

export type CreateJobPostingInput = z.infer<typeof createJobPostingSchema>;

export const updateJobPostingSchema = createJobPostingSchema.partial().extend({
  id: z.string().min(1),
});

export type UpdateJobPostingInput = z.infer<typeof updateJobPostingSchema>;

export const jobApplicationSchema = z.object({
  jobPostingId: z.string().min(1),
  message: z.string().optional(),
});

export type JobApplicationInput = z.infer<typeof jobApplicationSchema>;

export const jobSearchSchema = z.object({
  occupationSubItemId: z.string().optional(),
  areaId: z.string().optional(),
  keyword: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
});

export type JobSearchInput = z.infer<typeof jobSearchSchema>;
