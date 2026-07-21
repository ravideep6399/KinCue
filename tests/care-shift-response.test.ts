import assert from "node:assert/strict";
import test from "node:test";
import { shiftStatusAfterDecline } from "../src/time/care-shift-response.ts";

test("the first decline keeps a two-caregiver shift pending", () => {
  assert.equal(shiftStatusAfterDecline({
    actorUserId: "primary",
    primaryUserId: "primary",
    backupUserId: "backup",
    previousDeclinedByUserId: null,
  }), "pending");
});

test("the second caregiver decline closes the shift", () => {
  assert.equal(shiftStatusAfterDecline({
    actorUserId: "backup",
    primaryUserId: "primary",
    backupUserId: "backup",
    previousDeclinedByUserId: "primary",
  }), "declined");
});

test("a shift without backup closes after its only caregiver declines", () => {
  assert.equal(shiftStatusAfterDecline({
    actorUserId: "primary",
    primaryUserId: "primary",
    backupUserId: null,
    previousDeclinedByUserId: null,
  }), "declined");
});
