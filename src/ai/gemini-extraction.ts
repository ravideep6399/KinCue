import { z } from "zod";
import { handoverExtractionSchema } from "./schemas";
import { runtimeSkills } from "./skill-loader";

export async function extractHandoverWithGemini(transcript: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const responseSchema = simplifySchema(z.toJSONSchema(handoverExtractionSchema));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: runtimeSkills.extractHandover }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Extract proposed KinCue records from this handover:\n\n${transcript}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as GeminiErrorResponse | null;
    const detail = errorBody?.error?.message?.replace(/\s+/g, " ").trim();
    throw new Error(
      `Gemini request failed with status ${response.status}${detail ? `: ${detail}` : "."}`,
    );
  }

  const body = (await response.json()) as GeminiResponse;
  const output = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!output) throw new Error("Gemini did not return structured output.");

  return handoverExtractionSchema.parse(JSON.parse(output));
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type GeminiErrorResponse = {
  error?: { message?: string };
};

function simplifySchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(simplifySchema);
  if (!value || typeof value !== "object") return value;

  const omittedConstraints = new Set([
    "$schema",
    "additionalProperties",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
  ]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !omittedConstraints.has(key))
      .map(([key, nestedValue]) => [key, simplifySchema(nestedValue)]),
  );
}
