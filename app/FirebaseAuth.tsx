"use client";

import type { User } from "firebase/auth";
import { LogIn, ShieldCheck } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { firebaseConfigured } from "../src/firebase/config";

type Identity = {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
};

type AuthState = {
  identity: Identity | null;
  status: "loading" | "authenticated" | "unauthenticated" | "unconfigured" | "error";
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);

function identityFromFirebase(user: User): Identity {
  return {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? user.email ?? "KinCue member",
    photoUrl: user.photoURL,
  };
}

function friendlyAuthError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";

  if (code.includes("popup-closed-by-user")) {
    return "Google sign-in was closed before it finished.";
  }
  if (code.includes("popup-blocked")) {
    return "Your browser blocked the Google sign-in window. Allow pop-ups for KinCue and try again.";
  }
  if (code.includes("unauthorized-domain")) {
    return "This address is not authorized in Firebase Authentication.";
  }
  if (code.includes("operation-not-allowed")) {
    return "Google sign-in is not enabled for this Firebase project.";
  }
  if (code.includes("network-request-failed")) {
    return "The sign-in request could not reach Firebase. Check your connection and try again.";
  }

  return error instanceof Error ? error.message : "Google sign-in could not be completed.";
}

async function ensureUserProfile(user: User) {
  const [{ getFirebaseClient }, { doc, runTransaction, serverTimestamp }] =
    await Promise.all([
      import("../src/firebase/client"),
      import("firebase/firestore"),
    ]);
  const { db } = getFirebaseClient();
  const profileRef = doc(db, "users", user.uid);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(profileRef);
    const profile = {
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? user.email ?? "KinCue member",
      photoUrl: user.photoURL,
      updatedAt: serverTimestamp(),
    };

    transaction.set(
      profileRef,
      existing.exists()
        ? profile
        : { ...profile, createdAt: serverTimestamp() },
      { merge: true },
    );
  });
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>(
    firebaseConfigured ? "loading" : "unconfigured",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) return;

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    void Promise.all([
      import("../src/firebase/client"),
      import("firebase/auth"),
    ])
      .then(async ([{ getFirebaseClient }, authModule]) => {
        if (disposed) return;
        const { auth } = getFirebaseClient();
        await authModule.setPersistence(auth, authModule.browserLocalPersistence);

        // Complete any redirect started by an older KinCue build and surface its error.
        await authModule.getRedirectResult(auth);
        if (disposed) return;

        unsubscribe = authModule.onAuthStateChanged(
          auth,
          (user) => {
            if (!user) {
              setIdentity(null);
              setStatus("unauthenticated");
              return;
            }

            setIdentity(identityFromFirebase(user));
            setStatus("authenticated");
            void ensureUserProfile(user).catch((profileError) => {
              console.error(
                "Could not synchronize the KinCue user profile.",
                profileError,
              );
            });
          },
          (authError) => {
            setError(authError.message);
            setStatus("error");
          },
        );
      })
      .catch((initializationError) => {
        if (disposed) return;
        setError(friendlyAuthError(initializationError));
        setStatus("error");
      });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      identity,
      status,
      error,
      async signInWithGoogle() {
        setError(null);
        try {
          const [
            { getFirebaseClient },
            { browserLocalPersistence, GoogleAuthProvider, setPersistence, signInWithPopup },
          ] = await Promise.all([
            import("../src/firebase/client"),
            import("firebase/auth"),
          ]);
          const { auth } = getFirebaseClient();
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          setStatus("loading");
          await setPersistence(auth, browserLocalPersistence);
          await signInWithPopup(auth, provider);
        } catch (signInError) {
          setError(friendlyAuthError(signInError));
          setStatus("error");
        }
      },
      async signOut() {
        if (!firebaseConfigured) return;
        const [{ getFirebaseClient }, { signOut: firebaseSignOut }] =
          await Promise.all([
            import("../src/firebase/client"),
            import("firebase/auth"),
          ]);
        const { auth } = getFirebaseClient();
        await firebaseSignOut(auth);
      },
      async getAccessToken() {
        if (!firebaseConfigured) return null;
        const { getFirebaseClient } = await import("../src/firebase/client");
        const { auth } = getFirebaseClient();
        return auth.currentUser?.getIdToken() ?? null;
      },
    }),
    [error, identity, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useKinCueAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useKinCueAuth must be used inside FirebaseAuthProvider.");
  return value;
}

export function FirebaseAuthGate({ children }: { children: ReactNode }) {
  const { status, error, signInWithGoogle } = useKinCueAuth();

  if (status === "loading") {
    return <main className="auth-screen"><div className="auth-status">Opening KinCue...</div></main>;
  }

  if (status === "unconfigured") {
    return (
      <main className="auth-screen">
        <section className="auth-panel">
          <span className="auth-mark"><ShieldCheck size={24} /></span>
          <p className="eyebrow">Configuration required</p>
          <h1>Firebase is not connected</h1>
          <p>Add the required Firebase environment values before using KinCue.</p>
        </section>
      </main>
    );
  }

  if (status === "unauthenticated" || status === "error") {
    return (
      <main className="auth-screen">
        <section className="auth-panel">
          <span className="auth-mark"><ShieldCheck size={24} /></span>
          <p className="eyebrow">Private family workspace</p>
          <h1>Sign in to KinCue</h1>
          <p>Use your Google account to enter your family space.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-button" onClick={signInWithGoogle} type="button">
            <LogIn size={18} /> Continue with Google
          </button>
        </section>
      </main>
    );
  }

  return children;
}
