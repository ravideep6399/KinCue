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
import type { HandoverExtraction } from "../ai/schemas";
import { getFirebaseClient } from "./client";
import type { HandoverProvider, HandoverRecord } from "./models";

export async function saveHandover(
  familySpaceId: string,
  identity: { uid: string; displayName: string },
  transcript: string,
  extraction: HandoverExtraction,
  provider: HandoverProvider,
) {
  const { db } = getFirebaseClient();
  const handoverRef = doc(collection(db, "familySpaces", familySpaceId, "handovers"));
  await setDoc(handoverRef, {
    id: handoverRef.id,
    transcript: transcript.trim(),
    summary: extraction.summary,
    items: extraction.items,
    unresolvedQuestions: extraction.unresolvedQuestions,
    provider,
    createdByUserId: identity.uid,
    createdByDisplayName: identity.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToHandovers(
  familySpaceId: string,
  onChange: (handovers: HandoverRecord[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const { db } = getFirebaseClient();
  const handovers = query(
    collection(db, "familySpaces", familySpaceId, "handovers"),
    orderBy("createdAt", "desc"),
    limit(10),
  );
  return onSnapshot(
    handovers,
    (snapshot) => onChange(snapshot.docs.map((handover) => ({
      ...(handover.data() as Omit<HandoverRecord, "id">),
      id: handover.id,
    }))),
    onError,
  );
}
