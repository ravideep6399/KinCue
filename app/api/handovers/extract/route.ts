import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { handoverExtractionSchema } from "../../../../src/ai/schemas";
import { extractHandoverLocally } from "../../../../src/ai/local-extraction";
import { runtimeSkills } from "../../../../src/ai/skill-loader";

const requestSchema = z.object({
  familySpaceId: z.string().trim().min(1).max(128),
  transcript: z.string().trim().min(12).max(8000),
});

export async function POST(request: Request) {
  const { authenticateFirebaseRequest, FirebaseRequestError, getFirebaseAdmin } = await import(
    "../../../../src/firebase/admin"
  );
  let identity;
  try {
    identity = await authenticateFirebaseRequest(request);
  } catch (error) {
    if (error instanceof FirebaseRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Add a longer handover before structuring it." },
      { status: 400 },
    );
  }

  const membership = await getFirebaseAdmin().db
    .doc(`familySpaces/${parsed.data.familySpaceId}/members/${identity.uid}`)
    .get();
  if (!membership.exists || membership.data()?.role === "viewer") {
    return NextResponse.json(
      { error: "Contributor access to this Family Space is required." },
      { status: 403 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      extraction: extractHandoverLocally(parsed.data.transcript),
      mode: "local-rules",
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
    return NextResponse.json({
      extraction: extractHandoverLocally(parsed.data.transcript),
      mode: "local-fallback",
      warning: "OpenAI was unavailable, so KinCue used local extraction.",
    });
  }
}
