import { NextResponse } from "next/server";
import {
  authenticateFirebaseRequest,
  FirebaseRequestError,
  getFirebaseAdmin,
} from "../../../../../../src/firebase/admin";
import {
  getSupabaseAdmin,
  supabaseStorageBucket,
} from "../../../../../../src/storage/supabase-admin";
import {
  isValidVaultId,
  isVaultStoragePath,
} from "../../../../../../src/storage/vault-policy";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ spaceId: string; documentId: string }> };

async function loadAccess(request: Request, context: RouteContext) {
  const identity = await authenticateFirebaseRequest(request);
  const { spaceId, documentId } = await context.params;
  if (!isValidVaultId(spaceId) || !isValidVaultId(documentId)) return null;
  const { db } = getFirebaseAdmin();
  const [membership, document] = await Promise.all([
    db.doc(`familySpaces/${spaceId}/members/${identity.uid}`).get(),
    db.doc(`familySpaces/${spaceId}/documents/${documentId}`).get(),
  ]);

  return { db, spaceId, documentId, membership, document };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const access = await loadAccess(request, context);
    if (!access) {
      return NextResponse.json({ error: "The Vault path is invalid." }, { status: 400 });
    }
    const { spaceId, documentId, membership, document } = access;
    if (!membership.exists) {
      return NextResponse.json({ error: "Family Space membership is required." }, { status: 403 });
    }
    if (!document.exists) {
      return NextResponse.json({ error: "The Vault file was not found." }, { status: 404 });
    }

    const storagePath = document.data()?.storagePath;
    if (!isVaultStoragePath(spaceId, documentId, storagePath)) {
      return NextResponse.json({ error: "The Vault file path is invalid." }, { status: 409 });
    }

    const { data, error } = await getSupabaseAdmin()
      .storage
      .from(supabaseStorageBucket)
      .createSignedUrl(storagePath, 60);
    if (error) throw error;

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    if (error instanceof FirebaseRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Could not create Vault download URL", error);
    return NextResponse.json({ error: "The file could not be opened." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const access = await loadAccess(request, context);
    if (!access) {
      return NextResponse.json({ error: "The Vault path is invalid." }, { status: 400 });
    }
    const { db, spaceId, documentId, membership, document } = access;
    if (!membership.exists || !["owner", "primary_caregiver"].includes(membership.data()?.role)) {
      return NextResponse.json(
        { error: "Only owners and primary caregivers can delete Vault files." },
        { status: 403 },
      );
    }
    if (!document.exists) {
      return NextResponse.json({ error: "The Vault file was not found." }, { status: 404 });
    }

    const storagePath = document.data()?.storagePath;
    if (!isVaultStoragePath(spaceId, documentId, storagePath)) {
      return NextResponse.json({ error: "The Vault file path is invalid." }, { status: 409 });
    }

    const { error } = await getSupabaseAdmin()
      .storage
      .from(supabaseStorageBucket)
      .remove([storagePath]);
    if (error && !/not found/i.test(error.message)) throw error;

    await db.doc(`familySpaces/${spaceId}/documents/${documentId}`).delete();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof FirebaseRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Could not delete Vault file", error);
    return NextResponse.json({ error: "The file could not be deleted." }, { status: 500 });
  }
}
