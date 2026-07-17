import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handoverExtractionSchema } from "../../../../src/ai/schemas";
import { runtimeSkills } from "../../../../src/ai/skill-loader";

const requestSchema = z.object({
  transcript: z.string().trim().min(12).max(8000),
});

function localExtraction(transcript: string) {
  const timeMatch = transcript.match(
    /\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b/i,
  );
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const items = sentences
    .filter((sentence) =>
      /medicine|medication|appointment|call|drawer|bag|box|meal|dinner|breakfast|task/i.test(
        sentence,
      ),
    )
    .slice(0, 5)
    .map((sentence) => {
      const isMedication = /medicine|medication|tablet|dose/i.test(sentence);
      const isAppointment = /appointment|clinic|doctor/i.test(sentence);
      const isLocation = /drawer|bag|box|cabinet|shelf|kept|inside/i.test(
        sentence,
      );
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
        person: /grandma|grandmother/i.test(sentence) ? "Grandma" : null,
        scheduledTime: timeMatch?.[1] ?? null,
        condition: /after dinner/i.test(sentence) ? "After dinner" : null,
        location: isLocation ? sentence : null,
        assignee: null,
        sourceExcerpt: sentence,
        confidence:
          isMedication && !/\b\w+\s+\d+\s*mg\b/i.test(sentence)
            ? "medium"
            : "high",
        requiresConfirmation: true,
        warnings:
          isMedication && !/\b\w+\s+\d+\s*mg\b/i.test(sentence)
            ? ["Medicine name or strength was not clearly stated."]
            : [],
      } as const;
    });

  return handoverExtractionSchema.parse({
    summary:
      "A family handover containing schedule, care, and location updates is ready for review.",
    items,
    unresolvedQuestions:
      items.length === 0
        ? ["No actionable family updates were identified. Add more detail and try again."]
        : [],
  });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Add a longer handover before structuring it." },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      extraction: localExtraction(parsed.data.transcript),
      mode: "local-demo",
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6",
      input: [
        { role: "developer", content: runtimeSkills.extractHandover },
        {
          role: "user",
          content: `Extract proposed KinCue records from this handover:\n\n${parsed.data.transcript}`,
        },
      ],
      text: {
        format: zodTextFormat(
          handoverExtractionSchema,
          "handover_extraction",
        ),
      },
    });

    if (!response.output_parsed) {
      throw new Error("The model did not return a structured extraction.");
    }

    return NextResponse.json({
      extraction: response.output_parsed,
      mode: "gpt-5.6",
    });
  } catch (error) {
    console.error("Handover extraction failed", error);
    return NextResponse.json(
      { error: "KinCue could not structure this handover. Please try again." },
      { status: 502 },
    );
  }
}
