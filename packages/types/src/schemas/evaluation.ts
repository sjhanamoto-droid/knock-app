import { z } from "zod";

const ratingField = z.number().min(1, "1以上を選択してください").max(5, "5以下を選択してください");

export const submitEvaluationSchema = z.object({
  factoryFloorOrderId: z.string().min(1),
  evaluateeCompanyId: z.string().min(1),
  technicalSkill: ratingField,
  communication: ratingField,
  reliability: ratingField,
  comment: z.string().optional(),
});

export type SubmitEvaluationInput = z.infer<typeof submitEvaluationSchema>;
