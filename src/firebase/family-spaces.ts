import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseClient } from "./client";
import type { FamilyRole, FamilySpaceMembership } from "./models";

type CreateFamilySpaceInput = {
  uid: string;
  email: string;
  displayName: string;
  name: string;
  timezone: string;
};

export async function createFamilySpace(
  input: CreateFamilySpaceInput,
): Promise<FamilySpaceMembership> {
  const { db } = getFirebaseClient();
  const spaceRef = doc(collection(db, "familySpaces"));
  const memberRef = doc(spaceRef, "members", input.uid);
  const userSpaceRef = doc(
    db,
    "users",
    input.uid,
    "familySpaces",
    spaceRef.id,
  );
  const batch = writeBatch(db);
  const role: FamilyRole = "owner";

  batch.set(spaceRef, {
    id: spaceRef.id,
    name: input.name.trim(),
    ownerUid: input.uid,
    timezone: input.timezone,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(memberRef, {
    userId: input.uid,
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    relationshipLabel: null,
    role,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(userSpaceRef, {
    familySpaceId: spaceRef.id,
    name: input.name.trim(),
    timezone: input.timezone,
    role,
    relationshipLabel: null,
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    familySpaceId: spaceRef.id,
    name: input.name.trim(),
    timezone: input.timezone,
    role,
    relationshipLabel: null,
    createdAt: new Date(),
  };
}

export function subscribeToFamilySpaces(
  uid: string,
  onChange: (spaces: FamilySpaceMembership[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const { db } = getFirebaseClient();
  const memberships = query(
    collection(db, "users", uid, "familySpaces"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(
    memberships,
    (snapshot) => {
      onChange(
        snapshot.docs.map((membership) => ({
          ...(membership.data() as Omit<FamilySpaceMembership, "familySpaceId">),
          familySpaceId: membership.id,
        })),
      );
    },
    onError,
  );
}
