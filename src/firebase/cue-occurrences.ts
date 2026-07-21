import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseClient } from "./client";
import type { CueOccurrence } from "./models";

export function subscribeToCueOccurrences(
  familySpaceId: string,
  onChange: (occurrences: CueOccurrence[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const { db } = getFirebaseClient();
  const recent = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const occurrences = query(
    collection(db, "familySpaces", familySpaceId, "cueOccurrences"),
    where("scheduledAt", ">=", recent),
    orderBy("scheduledAt", "asc"),
  );
  return onSnapshot(
    occurrences,
    (snapshot) => onChange(snapshot.docs.map((occurrence) => ({
      ...(occurrence.data() as Omit<CueOccurrence, "id">),
      id: occurrence.id,
    }))),
    onError,
  );
}

export async function completeCue(familySpaceId: string, occurrenceId: string) {
  const { db } = getFirebaseClient();
  await updateDoc(doc(db, "familySpaces", familySpaceId, "cueOccurrences", occurrenceId), {
    status: "completed",
    acknowledgedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function snoozeCue(familySpaceId: string, occurrenceId: string, minutes: number) {
  const { db } = getFirebaseClient();
  await updateDoc(doc(db, "familySpaces", familySpaceId, "cueOccurrences", occurrenceId), {
    status: "snoozed",
    snoozedUntil: Timestamp.fromMillis(Date.now() + minutes * 60 * 1000),
    updatedAt: serverTimestamp(),
  });
}

export async function blockCue(familySpaceId: string, occurrenceId: string, reason: string) {
  const { db } = getFirebaseClient();
  await updateDoc(doc(db, "familySpaces", familySpaceId, "cueOccurrences", occurrenceId), {
    status: "blocked",
    blockedReason: reason.trim(),
    updatedAt: serverTimestamp(),
  });
}
