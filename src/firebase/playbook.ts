import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseClient } from "./client";
import type { PlaybookCategory, PlaybookEntry } from "./models";
import { zonedInputToDate } from "../time/timezone";

export type PlaybookEntryInput = {
  title: string;
  category: PlaybookCategory;
  details: string;
  locationLabel: string;
  reminderAt: string;
  assignedUserId: string;
};

function optionalText(value: string) {
  return value.trim() || null;
}

export async function createPlaybookEntry(
  familySpaceId: string,
  createdByUserId: string,
  timeZone: string,
  input: PlaybookEntryInput,
) {
  const { db } = getFirebaseClient();
  const entryRef = doc(collection(db, "familySpaces", familySpaceId, "playbookEntries"));
  await setDoc(entryRef, {
    id: entryRef.id,
    title: input.title.trim(),
    category: input.category,
    details: input.details.trim(),
    locationLabel: optionalText(input.locationLabel),
    reminderAt: input.reminderAt ? Timestamp.fromDate(zonedInputToDate(input.reminderAt, timeZone)) : null,
    assignedUserId: optionalText(input.assignedUserId),
    active: true,
    createdByUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePlaybookEntry(
  familySpaceId: string,
  entryId: string,
  timeZone: string,
  input: PlaybookEntryInput,
) {
  const { db } = getFirebaseClient();
  await updateDoc(doc(db, "familySpaces", familySpaceId, "playbookEntries", entryId), {
    title: input.title.trim(),
    category: input.category,
    details: input.details.trim(),
    locationLabel: optionalText(input.locationLabel),
    reminderAt: input.reminderAt ? Timestamp.fromDate(zonedInputToDate(input.reminderAt, timeZone)) : null,
    assignedUserId: optionalText(input.assignedUserId),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToPlaybookEntries(
  familySpaceId: string,
  onChange: (entries: PlaybookEntry[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const { db } = getFirebaseClient();
  const entries = query(
    collection(db, "familySpaces", familySpaceId, "playbookEntries"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    entries,
    (snapshot) => onChange(snapshot.docs.map((entry) => ({
      ...(entry.data() as Omit<PlaybookEntry, "id">),
      id: entry.id,
    })).filter((entry) => entry.active)),
    onError,
  );
}
