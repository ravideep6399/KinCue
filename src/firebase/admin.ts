import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, initializeFirestore } from "firebase-admin/firestore";

const adminConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID ?? "",
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
  privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
};

const firebaseWebConfiguredOnServer = [
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
].every(Boolean);

export const firebaseAdminConfigured = Object.values(adminConfig).every(Boolean);

export function getFirebaseAdmin() {
  if (!firebaseAdminConfigured) {
    throw new Error("Firebase Admin is not configured.");
  }

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert(adminConfig),
          projectId: adminConfig.projectId,
        });

  let db;
  try {
    db = getFirestore(app);
  } catch {
    db = initializeFirestore(app, { preferRest: true });
  }

  return { app, auth: getAuth(app), db };
}

export type RequestIdentity = {
  uid: string;
  email: string | null;
  displayName: string;
};

export class FirebaseRequestError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 503,
  ) {
    super(message);
  }
}

export async function authenticateFirebaseRequest(
  request: Request,
): Promise<RequestIdentity> {
  if (!firebaseWebConfiguredOnServer) {
    throw new FirebaseRequestError("Firebase is not configured.", 503);
  }

  if (!firebaseAdminConfigured) {
    throw new FirebaseRequestError(
      "Firebase server credentials are not configured.",
      503,
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new FirebaseRequestError("Authentication is required.", 401);
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const decoded = await getFirebaseAdmin().auth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : null,
      displayName:
        typeof decoded.name === "string"
          ? decoded.name
          : typeof decoded.email === "string"
            ? decoded.email
            : "KinCue member",
    };
  } catch {
    throw new FirebaseRequestError("The authentication session is invalid.", 401);
  }
}
