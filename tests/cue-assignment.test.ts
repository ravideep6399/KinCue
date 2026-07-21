import assert from "node:assert/strict";
import test from "node:test";
import {
  assignedCaregiverForShift,
  findCoveringShift,
  type ShiftCoverage,
} from "../src/time/cue-assignment.ts";

const shifts: ShiftCoverage[] = [
  {
    id: "shift-a",
    careProfileId: "profile-a",
    assignedUserId: "caregiver-a",
    startsAtMillis: 1_000,
    endsAtMillis: 3_000,
  },
  {
    id: "shift-b",
    careProfileId: "profile-b",
    assignedUserId: "caregiver-b",
    startsAtMillis: 1_000,
    endsAtMillis: 3_000,
  },
];

test("findCoveringShift matches both care recipient and time", () => {
  assert.equal(findCoveringShift(shifts, "profile-b", 2_000)?.id, "shift-b");
});

test("findCoveringShift excludes another care recipient's overlapping shift", () => {
  assert.equal(findCoveringShift(shifts, "profile-c", 2_000), undefined);
});

test("findCoveringShift treats the ending instant as outside the shift", () => {
  assert.equal(findCoveringShift(shifts, "profile-a", 3_000), undefined);
});

test("assignedCaregiverForShift honors a backup caregiver who accepted", () => {
  assert.equal(
    assignedCaregiverForShift("primary-caregiver", "backup-caregiver"),
    "backup-caregiver",
  );
  assert.equal(
    assignedCaregiverForShift("primary-caregiver", null),
    "primary-caregiver",
  );
});
