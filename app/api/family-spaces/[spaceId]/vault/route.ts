import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateFirebaseRequest,
  FirebaseRequestError,
  getFirebaseAdmin,
} from "../../../../../src/firebase/admin";
import {
  getSupabaseAdmin,
  supabaseStorageBucket,
} from "../../../../../src/storage/supabase-admin";
import {
  buildVaultStoragePath,
  isAllowedVaultContentType,
  isValidVaultId,
  maximumVaultFileSize,
  maximumVaultRequestSize,
} from "../../../../../src/storage/vault-policy";

export const runtime = "nodejs";

const metadataSchema = z.object({
  category: z.enum(["care", "identity", "household", "insurance", "other"]),
  description: z.string().trim().max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  try {
    const identity = await authenticateFirebaseRequest(request);
    const { spaceId } = await context.params;
    if (!isValidVaultId(spaceId)) {
      return NextResponse.json({ error: "The Family Space identifier is invalid." }, { status: 400 });
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maximumVaultRequestSize) {
      return NextResponse.json({ error: "Choose a file smaller than 10 MB." }, { status: 413 });
    }
    const { db } = getFirebaseAdmin();
    const membership = await db.doc(`familySpaces/${spaceId}/members/${identity.uid}`).get();

    if (!membership.exists || membership.data()?.role === "viewer") {
      return NextResponse.json(
        { error: "Contributor access to this Family Space is required." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const metadata = metadataSchema.safeParse({
      category: formData.get("category"),
      description: formData.get("description") ?? "",
    });

    if (!(file instanceof File) || !metadata.success) {
      return NextResponse.json({ error: "Choose a file and valid category." }, { status: 400 });
    }
    if (file.size <= 0 || file.size >= maximumVaultFileSize) {
      return NextResponse.json({ error: "Choose a file smaller than 10 MB." }, { status: 400 });
    }
    if (!isAllowedVaultContentType(file.type)) {
      return NextResponse.json(
        { error: "Vault files must be an image, PDF, or audio file." },
        { status: 400 },
      );
    }

    const documentRef = db.collection(`familySpaces/${spaceId}/documents`).doc();
    const storagePath = buildVaultStoragePath(spaceId, documentRef.id, file.name);
    const storage = getSupabaseAdmin().storage.from(supabaseStorageBucket);
    const { error: uploadError } = await storage.upload(
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      { contentType: file.type, upsert: false },
    );

    if (uploadError) throw uploadError;

    const now = Timestamp.now();
    const document = {
      id: documentRef.id,
      name: file.name.slice(0, 255),
      storagePath,
      contentType: file.type,
      size: file.size,
      category: metadata.data.category,
      description: metadata.data.description || null,
      uploadedByUserId: identity.uid,
      uploadedByDisplayName: identity.displayName.slice(0, 100),
      createdAt: now,
      updatedAt: now,
    };

    try {
      await documentRef.set(document);
    } catch (error) {
      await storage.remove([storagePath]).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ id: document.id }, { status: 201 });
  } catch (error) {
    if (error instanceof FirebaseRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Could not upload Vault file", error);
    return NextResponse.json(
      { error: "The file could not be uploaded. Check the private Storage configuration." },
      { status: 500 },
    );
  }
}
