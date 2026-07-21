export type ShiftCoverage = {
  id: string;
  careProfileId: string;
  assignedUserId: string;
  startsAtMillis: number;
  endsAtMillis: number;
};

export function findCoveringShift(
  shifts: ShiftCoverage[],
  careProfileId: string,
  scheduledAtMillis: number,
) {
  return shifts.find(
    (shift) =>
      shift.careProfileId === careProfileId &&
      shift.startsAtMillis <= scheduledAtMillis &&
      shift.endsAtMillis > scheduledAtMillis,
  );
}

export function assignedCaregiverForShift(
  primaryUserId: string,
  acceptedByUserId: string | null,
) {
  return acceptedByUserId || primaryUserId;
}
