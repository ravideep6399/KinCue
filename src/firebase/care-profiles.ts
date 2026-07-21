import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseClient } from "./client";
import type { CareProfile } from "./models";

export type CareProfileInput = {
  linkedMemberUserId: string;
  fullName: string;
  preferredName: string;
  relationshipLabel: string;
  careNeedsSummary: string;
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

export async function createCareProfile(
  familySpaceId: string,
  createdByUserId: string,
  input: CareProfileInput,
) {
  const { db } = getFirebaseClient();
  const profiles = collection(db, "familySpaces", familySpaceId, "careProfiles");
  const profileRef = input.linkedMemberUserId
    ? doc(profiles, input.linkedMemberUserId)
    : doc(profiles);

  if (input.linkedMemberUserId && (await getDoc(profileRef)).exists()) {
    throw new Error("That household member already has a care profile.");
  }

  await setDoc(profileRef, {
    id: profileRef.id,
    linkedMemberUserId: optionalText(input.linkedMemberUserId),
    fullName: input.fullName.trim(),
    preferredName: optionalText(input.preferredName),
    relationshipLabel: optionalText(input.relationshipLabel),
    careNeedsSummary: optionalText(input.careNeedsSummary),
    status: "active",
    createdByUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return profileRef.id;
}

export async function updateCareProfile(
  familySpaceId: string,
  profileId: string,
  input: CareProfileInput,
) {
  const { db } = getFirebaseClient();
  await updateDoc(doc(db, "familySpaces", familySpaceId, "careProfiles", profileId), {
    fullName: input.fullName.trim(),
    preferredName: optionalText(input.preferredName),
    relationshipLabel: optionalText(input.relationshipLabel),
    careNeedsSummary: optionalText(input.careNeedsSummary),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToCareProfiles(
  familySpaceId: string,
  onChange: (profiles: CareProfile[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const { db } = getFirebaseClient();
  const profiles = query(
    collection(db, "familySpaces", familySpaceId, "careProfiles"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(
    profiles,
    (snapshot) => {
      onChange(
        snapshot.docs.map((profile) => ({
          ...(profile.data() as Omit<CareProfile, "id">),
          id: profile.id,
        })),
      );
    },
    onError,
  );
}
