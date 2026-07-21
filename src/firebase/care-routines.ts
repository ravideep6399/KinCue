import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseClient } from "./client";
import type {
  CareRoutine,
  CareRoutineCategory,
  CareRoutineImportance,
} from "./models";

export type CareRoutineInput = {
  title: string;
  instructions: string;
  category: CareRoutineCategory;
  importance: CareRoutineImportance;
  timeOfDay: string;
  daysOfWeek: number[];
};

export async function createCareRoutine(
  familySpaceId: string,
  careProfileId: string,
  createdByUserId: string,
  input: CareRoutineInput,
) {
  const { db } = getFirebaseClient();
  const routineRef = doc(collection(db, "familySpaces", familySpaceId, "instructions"));
  await setDoc(routineRef, {
    id: routineRef.id,
    careProfileId,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    category: input.category,
    importance: input.importance,
    timeOfDay: input.timeOfDay || null,
    daysOfWeek: input.timeOfDay ? [...input.daysOfWeek].sort() : [],
    active: true,
    createdByUserId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCareRoutine(
  familySpaceId: string,
  routineId: string,
  input: CareRoutineInput,
) {
  const { db } = getFirebaseClient();
  await updateDoc(doc(db, "familySpaces", familySpaceId, "instructions", routineId), {
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    category: input.category,
    importance: input.importance,
    timeOfDay: input.timeOfDay || null,
    daysOfWeek: input.timeOfDay ? [...input.daysOfWeek].sort() : [],
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToCareRoutines(
  familySpaceId: string,
  careProfileId: string,
  onChange: (routines: CareRoutine[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const { db } = getFirebaseClient();
  const routines = query(
    collection(db, "familySpaces", familySpaceId, "instructions"),
    where("careProfileId", "==", careProfileId),
  );

  return onSnapshot(
    routines,
    (snapshot) => {
      onChange(
        snapshot.docs
          .map((routine) => ({
            ...(routine.data() as Omit<CareRoutine, "id">),
            id: routine.id,
          }))
          .filter((routine) => routine.active),
      );
    },
    onError,
  );
}
