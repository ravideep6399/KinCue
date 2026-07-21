import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateFirebaseRequest,
  FirebaseRequestError,
  getFirebaseAdmin,
} from "../../../../../src/firebase/admin";

const invitationSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["primary_caregiver", "helper", "viewer"]),
  relationshipLabel: z.string().trim().max(40).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  try {
    const identity = await authenticateFirebaseRequest(request);
    const { spaceId } = await context.params;
    const parsed = invitationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid invitation." }, { status: 400 });
    }

    const { db } = getFirebaseAdmin();
    const [space, membership] = await Promise.all([
      db.doc(`familySpaces/${spaceId}`).get(),
      db.doc(`familySpaces/${spaceId}/members/${identity.uid}`).get(),
    ]);

    if (!space.exists || membership.data()?.role !== "owner") {
      return NextResponse.json(
        { error: "Only the Family Space owner can invite members." },
        { status: 403 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await db
      .collection(`familySpaces/${spaceId}/members`)
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!existing.empty) {
      return NextResponse.json(
        { error: "That person is already a member of this Family Space." },
        { status: 409 },
      );
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000);

    await db.doc(`invitations/${tokenHash}`).set({
      familySpaceId: spaceId,
      familySpaceName: space.data()?.name,
      timezone: space.data()?.timezone,
      invitedByUserId: identity.uid,
      inviteeEmail: email,
      role: parsed.data.role,
      relationshipLabel: parsed.data.relationshipLabel || null,
      status: "pending",
      createdAt: now,
      expiresAt,
    });

    return NextResponse.json({
      inviteUrl: `${new URL(request.url).origin}/invite/${token}`,
      expiresAt: expiresAt.toDate().toISOString(),
    });
  } catch (error) {
    if (error instanceof FirebaseRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Could not create family invitation", error);
    return NextResponse.json({ error: "The invitation could not be created." }, { status: 500 });
  }
}
