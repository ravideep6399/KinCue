import { handoverExtractionSchema } from "./schemas.ts";

export function extractHandoverLocally(transcript: string) {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const items = sentences
    .filter((sentence) =>
      /medicine|medication|tablet|dose|\b\d+\s*(?:mg|mcg|g|ml)\b|appointment|clinic|doctor|call|drawer|bag|box|cabinet|shelf|meal|dinner|breakfast|task/i.test(
        sentence,
      ),
    )
    .slice(0, 5)
    .map((sentence) => {
      const timeMatch = sentence.match(
        /\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b/i,
      );
      const conditionMatch = sentence.match(/\bafter\s+(?:breakfast|lunch|dinner|a meal)\b/i);
      const isMedication = /medicine|medication|tablet|dose|\b\d+\s*(?:mg|mcg|g|ml)\b/i.test(sentence);
      const isAppointment = /appointment|clinic|doctor/i.test(sentence);
      const isLocation = /drawer|bag|box|cabinet|shelf|kept|inside/i.test(sentence);
      const type = isMedication
        ? "medication_instruction"
        : isAppointment
          ? "appointment"
          : isLocation
            ? "item_location"
            : "task";

      return {
        type,
        title: isMedication
          ? "Medication instruction"
          : isAppointment
            ? "Appointment update"
            : isLocation
              ? "Item location"
              : "Follow-up task",
        person: null,
        scheduledTime: timeMatch?.[1] ?? null,
        condition: conditionMatch?.[0] ?? null,
        location: isLocation ? sentence.slice(0, 500) : null,
        assignee: null,
        sourceExcerpt: sentence.slice(0, 1000),
        confidence: isMedication && !/\b\w+\s+\d+\s*mg\b/i.test(sentence) ? "medium" : "high",
        requiresConfirmation: true,
        warnings:
          isMedication && !/\b\w+\s+\d+\s*mg\b/i.test(sentence)
            ? ["Medicine name or strength was not clearly stated."]
            : [],
      } as const;
    });

  return handoverExtractionSchema.parse({
    summary: "A family handover containing schedule, care, and location updates is ready for review.",
    items,
    unresolvedQuestions:
      items.length === 0
        ? ["No actionable family updates were identified. Add more detail and try again."]
        : [],
  });
}
