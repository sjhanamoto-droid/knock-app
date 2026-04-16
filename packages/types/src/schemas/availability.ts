import { z } from "zod";

export const updateAvailabilitySchema = z.object({
  date: z.string().min(1, "日付を指定してください"),
  status: z.enum(["AVAILABLE", "BUSY", "NEGOTIABLE"]),
});

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;

export const bulkUpdateAvailabilitySchema = z.object({
  slots: z.array(updateAvailabilitySchema).min(1),
  isPublic: z.boolean().optional(),
});

export type BulkUpdateAvailabilityInput = z.infer<typeof bulkUpdateAvailabilitySchema>;
