import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig, firebaseConfigured } from "./config";

export function getFirebaseClient() {
  if (!firebaseConfigured) {
    throw new Error("Firebase is not configured for this environment.");
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  };
}
