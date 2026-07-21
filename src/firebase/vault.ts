import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseClient } from "./client";
import type { VaultDocument, VaultDocumentCategory } from "./models";

export async function uploadVaultDocument(
  familySpaceId: string,
  accessToken: string,
  file: File,
  category: VaultDocumentCategory,
  description: string,
) {
  const body = new FormData();
  body.set("file", file);
  body.set("category", category);
  body.set("description", description);
  await vaultRequest(`/api/family-spaces/${familySpaceId}/vault`, accessToken, {
    method: "POST",
    body,
  });
}

export async function getVaultDocumentUrl(
  familySpaceId: string,
  documentId: string,
  accessToken: string,
) {
  const body = await vaultRequest(
    `/api/family-spaces/${familySpaceId}/vault/${documentId}`,
    accessToken,
  );
  return String(body.url);
}

export async function removeVaultDocument(
  familySpaceId: string,
  documentId: string,
  accessToken: string,
) {
  await vaultRequest(`/api/family-spaces/${familySpaceId}/vault/${documentId}`, accessToken, {
    method: "DELETE",
  });
}

export function subscribeToVaultDocuments(
  familySpaceId: string,
  onChange: (documents: VaultDocument[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const { db } = getFirebaseClient();
  const documents = query(
    collection(db, "familySpaces", familySpaceId, "documents"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    documents,
    (snapshot) => onChange(snapshot.docs.map((item) => ({
      ...(item.data() as Omit<VaultDocument, "id">),
      id: item.id,
    }))),
    onError,
  );
}

async function vaultRequest(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      authorization: `Bearer ${accessToken}`,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "The Vault request failed.");
  }
  return body as Record<string, unknown>;
}
