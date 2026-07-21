import assert from "node:assert/strict";
import test from "node:test";
import { extractHandoverLocally } from "../src/ai/local-extraction.ts";

test("extracts medication, appointment, and item-location proposals without inventing details", () => {
  const result = extractHandoverLocally(
    "Give Paracetamol 500 mg at 8:30 AM after breakfast. " +
      "The doctor appointment is at 4 PM. " +
      "The insurance file is kept inside the blue drawer.",
  );

  assert.equal(result.items.length, 3);
  assert.deepEqual(
    result.items.map((item) => item.type),
    ["medication_instruction", "appointment", "item_location"],
  );
  assert.equal(result.items[0].scheduledTime, "8:30 AM");
  assert.equal(result.items[0].condition, "after breakfast");
  assert.equal(result.items[0].confidence, "high");
  assert.equal(result.items[0].requiresConfirmation, true);
});

test("flags incomplete medicine instructions for human confirmation", () => {
  const result = extractHandoverLocally("Give the medicine after dinner every day.");

  assert.equal(result.items[0].confidence, "medium");
  assert.match(result.items[0].warnings[0], /name or strength/i);
  assert.equal(result.items[0].requiresConfirmation, true);
});

test("returns an unresolved question when no actionable update is recognized", () => {
  const result = extractHandoverLocally("Everything went normally today and everyone is comfortable.");

  assert.equal(result.items.length, 0);
  assert.equal(result.unresolvedQuestions.length, 1);
});

test("keeps fallback output within the persistence contract for long input", () => {
  const result = extractHandoverLocally(`The medicine is in the drawer ${"x".repeat(3000)}.`);

  assert.ok(result.items[0].sourceExcerpt.length <= 1000);
  assert.ok((result.items[0].location?.length ?? 0) <= 500);
});
