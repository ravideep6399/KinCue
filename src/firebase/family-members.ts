import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseClient } from "./client";
import type { FamilyMember } from "./models";

export function subscribeToFamilyMembers(
  familySpaceId: string,
  onChange: (members: FamilyMember[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const { db } = getFirebaseClient();
  const members = query(
    collection(db, "familySpaces", familySpaceId, "members"),
    orderBy("joinedAt", "asc"),
  );

  return onSnapshot(
    members,
    (snapshot) => {
      onChange(snapshot.docs.map((member) => member.data() as FamilyMember));
    },
    onError,
  );
}
