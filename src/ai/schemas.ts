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
  title: z.string().min(1).max(100),
  person: z.string().max(100).nullable(),
  scheduledTime: z.string().max(100).nullable(),
  condition: z.string().max(300).nullable(),
  location: z.string().max(500).nullable(),
  assignee: z.string().max(100).nullable(),
  sourceExcerpt: z.string().min(1).max(1000),
  confidence: z.enum(["high", "medium", "low"]),
  requiresConfirmation: z.boolean(),
  warnings: z.array(z.string().min(1).max(300)).max(5),
});

export const handoverExtractionSchema = z.object({
  summary: z.string().min(1).max(2000),
  items: z.array(handoverItemSchema).max(20),
  unresolvedQuestions: z.array(z.string().min(1).max(500)).max(20),
});

export type HandoverExtraction = z.infer<typeof handoverExtractionSchema>;
