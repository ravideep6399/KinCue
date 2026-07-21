import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseClient } from "./client";
import type { CareShift, CareShiftStatus } from "./models";
import { zonedInputToDate } from "../time/timezone";
import { shiftStatusAfterDecline } from "../time/care-shift-response";

export type CareShiftInput = {
  careProfileId: string;
  title: string;
  primaryUserId: string;
  backupUserId: string;
  startsAt: string;
  endsAt: string;
  acceptanceDeadline: string;
};

export async function createCareShift(
  familySpaceId: string,
  createdByUserId: string,
  timeZone: string,
  input: CareShiftInput,
) {
  const startsAt = zonedInputToDate(input.startsAt, timeZone);
  const endsAt = zonedInputToDate(input.endsAt, timeZone);
  const deadline = input.acceptanceDeadline ? zonedInputToDate(input.acceptanceDeadline, timeZone) : null;
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt) {
    throw new Error("The shift end must be after its start.");
  }
  if (deadline && (!Number.isFinite(deadline.getTime()) || deadline >= startsAt)) {
    throw new Error("The acceptance deadline must be before the shift starts.");
  }

  const { db } = getFirebaseClient();
  const shiftRef = doc(collection(db, "familySpaces", familySpaceId, "careShifts"));
  await setDoc(shiftRef, {
    id: shiftRef.id,
    careProfileId: input.careProfileId,
    title: input.title.trim(),
    primaryUserId: input.primaryUserId,
    backupUserId: input.backupUserId || null,
    startsAt: Timestamp.fromDate(startsAt),
    endsAt: Timestamp.fromDate(endsAt),
    acceptanceDeadline: deadline ? Timestamp.fromDate(deadline) : null,
    status: "pending",
    acceptedAt: null,
    acceptedByUserId: null,
    declinedAt: null,
    declinedByUserId: null,
    createdByUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCareShiftStatus(
  familySpaceId: string,
  shiftId: string,
  status: CareShiftStatus,
  actorUserId: string,
) {
  const { db } = getFirebaseClient();
  const shiftRef = doc(db, "familySpaces", familySpaceId, "careShifts", shiftId);

  if (status === "accepted" || status === "declined") {
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(shiftRef);
      if (!snapshot.exists()) throw new Error("This care shift is no longer available.");
      const shift = snapshot.data() as CareShift;
      if (shift.status !== "pending") throw new Error("This care shift has already been answered.");

      if (status === "accepted") {
        transaction.update(shiftRef, {
          status: "accepted",
          acceptedAt: serverTimestamp(),
          acceptedByUserId: actorUserId,
          updatedAt: serverTimestamp(),
        });
        return "accepted" as const;
      }

      const nextStatus = shiftStatusAfterDecline({
        actorUserId,
        primaryUserId: shift.primaryUserId,
        backupUserId: shift.backupUserId,
        previousDeclinedByUserId: shift.declinedByUserId,
      });
      transaction.update(shiftRef, {
        status: nextStatus,
        declinedAt: serverTimestamp(),
        declinedByUserId: actorUserId,
        updatedAt: serverTimestamp(),
      });
      return nextStatus;
    });
  }

  const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  await updateDoc(shiftRef, updates);
  return status;
}

export function subscribeToCareShifts(
  familySpaceId: string,
  onChange: (shifts: CareShift[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const { db } = getFirebaseClient();
  const shifts = query(
    collection(db, "familySpaces", familySpaceId, "careShifts"),
    orderBy("startsAt", "asc"),
  );
  return onSnapshot(
    shifts,
    (snapshot) => onChange(snapshot.docs.map((shift) => ({
      ...(shift.data() as Omit<CareShift, "id">),
      id: shift.id,
    }))),
    onError,
  );
}
