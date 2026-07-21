import assert from "node:assert/strict";
import test from "node:test";
import {
  dateKeyInZone,
  toDate,
  toZonedDateTimeInput,
  zonedInputToDate,
} from "../src/time/timezone.ts";

test("round-trips datetime-local values in half-hour-offset family timezones", () => {
  const value = zonedInputToDate("2026-07-20T09:30", "Asia/Calcutta");

  assert.equal(value.toISOString(), "2026-07-20T04:00:00.000Z");
  assert.equal(toZonedDateTimeInput(value, "Asia/Calcutta"), "2026-07-20T09:30");
});

test("keeps date keys in the Family Space timezone across UTC day boundaries", () => {
  assert.equal(dateKeyInZone("2026-07-19T20:00:00.000Z", "Asia/Calcutta"), "2026-07-20");
  assert.equal(dateKeyInZone("2026-07-20T03:00:00.000Z", "America/Los_Angeles"), "2026-07-19");
});

test("accepts Firestore-like timestamp values", () => {
  const expected = new Date("2026-07-20T04:00:00.000Z");

  assert.equal(toDate({ toDate: () => expected }), expected);
});

test("rejects invalid datetime-local values and missing daylight-saving times", () => {
  assert.throws(() => zonedInputToDate("not-a-date", "Asia/Calcutta"), /valid date and time/);
  assert.throws(
    () => zonedInputToDate("2026-03-08T02:30", "America/New_York"),
    /does not exist/,
  );
});
