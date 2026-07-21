export function shiftStatusAfterDecline({
  actorUserId,
  primaryUserId,
  backupUserId,
  previousDeclinedByUserId,
}: {
  actorUserId: string;
  primaryUserId: string;
  backupUserId: string | null;
  previousDeclinedByUserId: string | null;
}) {
  const hasTwoAssignees = Boolean(backupUserId && backupUserId !== primaryUserId);
  const anotherAssigneeAlreadyDeclined = Boolean(
    previousDeclinedByUserId && previousDeclinedByUserId !== actorUserId,
  );
  return hasTwoAssignees && !anotherAssigneeAlreadyDeclined
    ? "pending" as const
    : "declined" as const;
}
