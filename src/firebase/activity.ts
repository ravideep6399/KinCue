import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseClient } from "./client";
import type { ActivityEvent } from "./models";

export async function recordActivity(
  familySpaceId: string,
  identity: { uid: string; displayName: string },
  type: string,
  summary: string,
) {
  try {
    const { db } = getFirebaseClient();
    const eventRef = doc(collection(db, "familySpaces", familySpaceId, "activityEvents"));
    await setDoc(eventRef, {
      id: eventRef.id,
      type,
      summary: summary.slice(0, 300),
      actorUserId: identity.uid,
      actorDisplayName: identity.displayName,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("KinCue activity event could not be recorded", error);
  }
}

export function subscribeToActivity(
  familySpaceId: string,
  onChange: (events: ActivityEvent[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const { db } = getFirebaseClient();
  const events = query(
    collection(db, "familySpaces", familySpaceId, "activityEvents"),
    orderBy("createdAt", "desc"),
    limit(30),
  );
  return onSnapshot(
    events,
    (snapshot) => onChange(snapshot.docs.map((event) => ({
      ...(event.data() as Omit<ActivityEvent, "id">),
      id: event.id,
    }))),
    onError,
  );
}
