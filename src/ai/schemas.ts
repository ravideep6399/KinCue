import { z } from "zod";

export const handoverItemSchema = z.object({
  type: z.enum([
    "medication_instruction",
    "appointment",
    "care_routine",
    "task",
    "item_location",
    "observation",
    "other",
  ]),
  title: z.string(),
  person: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  condition: z.string().nullable(),
  location: z.string().nullable(),
  assignee: z.string().nullable(),
  sourceExcerpt: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  requiresConfirmation: z.boolean(),
  warnings: z.array(z.string()),
});

export const handoverExtractionSchema = z.object({
  summary: z.string(),
  items: z.array(handoverItemSchema),
  unresolvedQuestions: z.array(z.string()),
});

export type HandoverExtraction = z.infer<typeof handoverExtractionSchema>;
