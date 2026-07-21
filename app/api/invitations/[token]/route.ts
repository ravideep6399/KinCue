import { createHash } from "node:crypto";
import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import {
  authenticateFirebaseRequest,
  FirebaseRequestError,
  getFirebaseAdmin,
  type RequestIdentity,
} from "../../../../src/firebase/admin";

function invitationRef(token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  return getFirebaseAdmin().db.doc(`invitations/${hash}`);
}

function validateInvitation(
  invitation: DocumentSnapshot,
  identity: RequestIdentity,
) {
  const data = invitation.data();
  if (!invitation.exists || !data || data.status !== "pending") {
    return "This invitation is no longer available.";
  }
  if (data.expiresAt.toMillis() <= Date.now()) {
    return "This invitation has expired.";
  }
  if (typeof data.timezone !== "string" || !data.timezone) {
    return "This invitation is missing Family Space details.";
  }
  if (!identity.email || data.inviteeEmail !== identity.email.toLowerCase()) {
    return `Sign in with ${data.inviteeEmail} to accept this invitation.`;
  }
  return null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const identity = await authenticateFirebaseRequest(request);
    const { token } = await context.params;
    const invitation = await invitationRef(token).get();
    const validationError = validateInvitation(invitation, identity);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 403 });
    }

    const data = invitation.data()!;
    return NextResponse.json({
      familySpaceName: data.familySpaceName,
      role: data.role,
      relationshipLabel: data.relationshipLabel,
      expiresAt: data.expiresAt.toDate().toISOString(),
    });
  } catch (error) {
    if (error instanceof FirebaseRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Could not load family invitation", error);
    return NextResponse.json({ error: "The invitation could not be loaded." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const identity = await authenticateFirebaseRequest(request);
    const { token } = await context.params;
    const { db } = getFirebaseAdmin();
    const inviteRef = invitationRef(token);

    const result = await db.runTransaction(async (transaction) => {
      const invitation = await transaction.get(inviteRef);
      const validationError = validateInvitation(invitation, identity);
      if (validationError) throw new Error(validationError);

      const data = invitation.data()!;
      const now = Timestamp.now();
      const memberRef = db.doc(
        `familySpaces/${data.familySpaceId}/members/${identity.uid}`,
      );
      const userSpaceRef = db.doc(
        `users/${identity.uid}/familySpaces/${data.familySpaceId}`,
      );

      transaction.set(memberRef, {
        userId: identity.uid,
        email: identity.email!.toLowerCase(),
        displayName: identity.displayName,
        relationshipLabel: data.relationshipLabel,
        role: data.role,
        joinedAt: now,
        updatedAt: now,
      });
      transaction.set(userSpaceRef, {
        familySpaceId: data.familySpaceId,
        name: data.familySpaceName,
        timezone: data.timezone,
        role: data.role,
        relationshipLabel: data.relationshipLabel,
        createdAt: now,
      });
      transaction.update(inviteRef, {
        status: "accepted",
        acceptedByUserId: identity.uid,
        acceptedAt: now,
      });

      return { familySpaceId: data.familySpaceId };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FirebaseRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "The invitation could not be accepted.";
    const expected = /invitation|Sign in with/i.test(message);
    if (!expected) console.error("Could not accept family invitation", error);
    return NextResponse.json({ error: expected ? message : "The invitation could not be accepted." }, { status: expected ? 403 : 500 });
  }
}
