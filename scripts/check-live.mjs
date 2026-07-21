import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { cert, deleteApp as deleteAdminApp, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, Timestamp } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";
import { deleteApp, initializeApp, setLogLevel } from "firebase/app";
import { getAuth, signInWithCustomToken, signOut } from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const values = await readEnvironmentFile(".env.local");
const value = (name) => process.env[name] || values.get(name) || "";
const supabaseSecret = value("SUPABASE_SECRET_KEY") || value("SUPABASE_SERVICE_ROLE_KEY");
const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "SUPABASE_URL",
];
const missing = required.filter((name) => !value(name));
if (!supabaseSecret) missing.push("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
if (missing.length) {
  console.error(`Live check cannot start. Missing: ${missing.join(", ")}`);
  process.exit(1);
}

const baseUrl = process.env.KINCUE_BASE_URL || "http://localhost:3004";
const runId = randomUUID().replaceAll("-", "");
const spaceId = `live_${runId}`;
const profileId = `profile_${runId}`;
const otherProfileId = `other_${runId}`;
const routineId = `routine_${runId}`;
const rightShiftId = `right_${runId}`;
const wrongShiftId = `wrong_${runId}`;
const adminApp = initializeAdminApp(
  {
    credential: cert({
      projectId: value("FIREBASE_PROJECT_ID"),
      clientEmail: value("FIREBASE_CLIENT_EMAIL"),
      privateKey: value("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
    projectId: value("FIREBASE_PROJECT_ID"),
  },
  `kincue-live-${runId}`,
);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);
const supabase = createClient(value("SUPABASE_URL"), supabaseSecret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const bucket = value("SUPABASE_STORAGE_BUCKET") || "kincue-vault";
const sessions = [];
const cleanupErrors = [];
let invitationHash = null;
let vaultDocumentId = null;

setLogLevel("silent");

try {
  const health = await fetch(baseUrl);
  assert(health.ok, `KinCue is not available at ${baseUrl}.`);

  const owner = await createSession("owner", "Live Owner");
  const backup = await createSession("backup", "Live Backup");
  const viewer = await createSession("viewer", "Live Viewer");
  const invitee = await createSession("invitee", "Live Invitee");
  const now = new Date();
  const local = localDateTimeParts(now, "Asia/Calcutta");
  const scheduledAt = new Date(now);
  scheduledAt.setSeconds(0, 0);
  const commonMember = (session, role) => ({
    userId: session.uid,
    email: session.email,
    displayName: session.displayName,
    relationshipLabel: null,
    role,
    joinedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await adminDb.doc(`familySpaces/${spaceId}`).set({
    id: spaceId,
    name: "KinCue live check",
    ownerUid: owner.uid,
    timezone: "Asia/Calcutta",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  await Promise.all([
    adminDb.doc(`familySpaces/${spaceId}/members/${owner.uid}`).set(commonMember(owner, "owner")),
    adminDb.doc(`familySpaces/${spaceId}/members/${backup.uid}`).set(commonMember(backup, "primary_caregiver")),
    adminDb.doc(`familySpaces/${spaceId}/members/${viewer.uid}`).set(commonMember(viewer, "viewer")),
    seedUserSpace(owner, "owner"),
    seedUserSpace(backup, "primary_caregiver"),
    seedUserSpace(viewer, "viewer"),
  ]);

  await assertRejectsPermission(
    setDoc(doc(viewer.db, `familySpaces/${spaceId}/careProfiles/denied_${runId}`), {
      id: `denied_${runId}`,
      linkedMemberUserId: null,
      fullName: "Denied profile",
      preferredName: null,
      relationshipLabel: null,
      careNeedsSummary: null,
      status: "active",
      createdByUserId: viewer.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    "Viewer unexpectedly created a Care Profile.",
  );
  await assertRejectsPermission(
    getDoc(doc(invitee.db, `familySpaces/${spaceId}`)),
    "A non-member unexpectedly read the Family Space.",
  );
  await assertRejectsPermission(
    setDoc(doc(owner.db, `familySpaces/${spaceId}/cues/forged_${runId}`), {
      title: "Forged browser cue",
    }),
    "An owner unexpectedly wrote a client-defined cue.",
  );
  await assertRejectsPermission(
    setDoc(doc(owner.db, `familySpaces/${spaceId}/deviceTokens/forged_${runId}`), {
      userId: owner.uid,
      token: "forged-browser-token",
    }),
    "An owner unexpectedly wrote an unvalidated device token.",
  );

  const inviteResponse = await api(owner, `/api/family-spaces/${spaceId}/invitations`, {
    method: "POST",
    body: JSON.stringify({ email: invitee.email, relationshipLabel: "Relative", role: "helper" }),
    headers: { "content-type": "application/json" },
  });
  assert(inviteResponse.status === 200, `Invitation creation returned ${inviteResponse.status}.`);
  const inviteBody = await inviteResponse.json();
  const token = new URL(inviteBody.inviteUrl).pathname.split("/").at(-1);
  invitationHash = createHash("sha256").update(token).digest("hex");
  const previewResponse = await api(invitee, `/api/invitations/${token}`);
  assert(previewResponse.status === 200, `Invitation preview returned ${previewResponse.status}.`);
  const acceptResponse = await api(invitee, `/api/invitations/${token}`, { method: "POST" });
  assert(acceptResponse.status === 200, `Invitation acceptance returned ${acceptResponse.status}.`);
  assert((await adminDb.doc(`familySpaces/${spaceId}/members/${invitee.uid}`).get()).exists, "Invitation did not create membership.");

  await Promise.all([
    adminDb.doc(`familySpaces/${spaceId}/careProfiles/${profileId}`).set(careProfile(profileId, owner.uid, "Care recipient")),
    adminDb.doc(`familySpaces/${spaceId}/careProfiles/${otherProfileId}`).set(careProfile(otherProfileId, owner.uid, "Other recipient")),
  ]);
  await adminDb.doc(`familySpaces/${spaceId}/instructions/${routineId}`).set({
    id: routineId,
    careProfileId: profileId,
    title: "Live cue check",
    instructions: "Follow the temporary test instruction.",
    category: "general",
    importance: "important",
    timeOfDay: `${pad(local.hour)}:${pad(local.minute)}`,
    daysOfWeek: [local.weekday],
    active: true,
    createdByUserId: owner.uid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  const shiftWindow = {
    title: "Live coverage",
    startsAt: Timestamp.fromMillis(scheduledAt.getTime() - 60 * 60 * 1000),
    endsAt: Timestamp.fromMillis(scheduledAt.getTime() + 60 * 60 * 1000),
    acceptanceDeadline: null,
    status: "accepted",
    acceptedAt: Timestamp.now(),
    declinedAt: null,
    declinedByUserId: null,
    createdByUserId: owner.uid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  await Promise.all([
    adminDb.doc(`familySpaces/${spaceId}/careShifts/${wrongShiftId}`).set({
      ...shiftWindow,
      id: wrongShiftId,
      careProfileId: otherProfileId,
      primaryUserId: owner.uid,
      backupUserId: null,
      acceptedByUserId: owner.uid,
    }),
    adminDb.doc(`familySpaces/${spaceId}/careShifts/${rightShiftId}`).set({
      ...shiftWindow,
      id: rightShiftId,
      careProfileId: profileId,
      primaryUserId: owner.uid,
      backupUserId: backup.uid,
      acceptedByUserId: backup.uid,
    }),
  ]);

  const syncResponse = await api(owner, `/api/family-spaces/${spaceId}/cues/sync`, { method: "POST" });
  assert(syncResponse.status === 200, `Cue synchronization returned ${syncResponse.status}.`);
  const cueQuery = await adminDb.collection(`familySpaces/${spaceId}/cueOccurrences`).where("cueId", "==", routineId).get();
  assert(cueQuery.size === 1, `Expected one live cue, received ${cueQuery.size}.`);
  const cue = cueQuery.docs[0].data();
  assert(cue.careProfileId === profileId, "Cue was generated for the wrong care recipient.");
  assert(cue.shiftId === rightShiftId, "Cue matched the wrong overlapping shift.");
  assert(cue.assignedUserId === backup.uid, "Cue was not assigned to the caregiver who accepted.");

  const handoverResponse = await api(owner, "/api/handovers/extract", {
    method: "POST",
    body: JSON.stringify({
      familySpaceId: spaceId,
      transcript: "Give the test medicine at 8 pm and confirm the next appointment tomorrow.",
    }),
    headers: { "content-type": "application/json" },
  });
  assert(handoverResponse.status === 200, `Handover extraction returned ${handoverResponse.status}.`);
  assert((await handoverResponse.json()).mode === "local-rules", "Handover did not use zero-spend local mode.");
  const deniedHandover = await api(viewer, "/api/handovers/extract", {
    method: "POST",
    body: JSON.stringify({ familySpaceId: spaceId, transcript: "This viewer request must be denied by the API." }),
    headers: { "content-type": "application/json" },
  });
  assert(deniedHandover.status === 403, `Viewer handover returned ${deniedHandover.status}, expected 403.`);

  const uploadForm = vaultForm();
  const uploadResponse = await api(owner, `/api/family-spaces/${spaceId}/vault`, { method: "POST", body: uploadForm });
  assert(uploadResponse.status === 201, `Vault upload returned ${uploadResponse.status}.`);
  vaultDocumentId = (await uploadResponse.json()).id;
  const openResponse = await api(viewer, `/api/family-spaces/${spaceId}/vault/${vaultDocumentId}`);
  assert(openResponse.status === 200, `Viewer Vault read returned ${openResponse.status}.`);
  const signedDownload = await fetch((await openResponse.json()).url);
  assert(signedDownload.ok && (await signedDownload.arrayBuffer()).byteLength > 0, "Signed Vault download failed.");
  const deniedUpload = await api(viewer, `/api/family-spaces/${spaceId}/vault`, { method: "POST", body: vaultForm() });
  assert(deniedUpload.status === 403, `Viewer Vault upload returned ${deniedUpload.status}, expected 403.`);
  const deniedDelete = await api(viewer, `/api/family-spaces/${spaceId}/vault/${vaultDocumentId}`, { method: "DELETE" });
  assert(deniedDelete.status === 403, `Viewer Vault delete returned ${deniedDelete.status}, expected 403.`);
  const deleteResponse = await api(owner, `/api/family-spaces/${spaceId}/vault/${vaultDocumentId}`, { method: "DELETE" });
  assert(deleteResponse.status === 200, `Owner Vault delete returned ${deleteResponse.status}.`);
  vaultDocumentId = null;

  console.log("KinCue live integration check passed.");
  console.log("- invitation acceptance and family membership");
  console.log("- viewer write denial and cross-family isolation");
  console.log("- server-only cue and device-token collections");
  console.log("- care-recipient-specific backup assignment and cue generation");
  console.log("- zero-spend handover extraction and role enforcement");
  console.log("- private Vault upload, signed read, role denial, and deletion");
} catch (error) {
  console.error(error instanceof Error ? `KinCue live integration check failed: ${error.message}` : "KinCue live integration check failed.");
  process.exitCode = 1;
} finally {
  if (vaultDocumentId) {
    const snapshot = await adminDb.doc(`familySpaces/${spaceId}/documents/${vaultDocumentId}`).get().catch(() => null);
    const storagePath = snapshot?.data()?.storagePath;
    if (typeof storagePath === "string") {
      const { error } = await supabase.storage.from(bucket).remove([storagePath]);
      if (error) cleanupErrors.push(`Vault object: ${error.message}`);
    }
  }
  await cleanup("temporary Family Space", adminDb.recursiveDelete(adminDb.doc(`familySpaces/${spaceId}`)));
  for (const session of sessions) {
    await cleanup(`temporary profile ${session.uid}`, adminDb.recursiveDelete(adminDb.doc(`users/${session.uid}`)));
  }
  if (invitationHash) await cleanup("temporary invitation", adminDb.doc(`invitations/${invitationHash}`).delete());
  for (const session of sessions) {
    await cleanup(`client session ${session.uid}`, signOut(session.auth));
    await cleanup(`client app ${session.uid}`, deleteApp(session.app));
    await cleanup(`temporary auth user ${session.uid}`, adminAuth.deleteUser(session.uid));
  }
  await cleanup("Admin app", deleteAdminApp(adminApp));
  if (cleanupErrors.length) {
    console.error(`Live-check cleanup failed: ${cleanupErrors.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log("Temporary live-check data removed.");
  }
}

async function createSession(label, displayName) {
  const uid = `${label}_${runId}`;
  const email = `${uid}@example.com`;
  await adminAuth.createUser({ uid, email, displayName });
  const app = initializeApp({
    apiKey: value("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: value("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: value("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    appId: value("NEXT_PUBLIC_FIREBASE_APP_ID"),
  }, `client-${label}-${runId}`);
  const auth = getAuth(app);
  const credential = await signInWithCustomToken(auth, await adminAuth.createCustomToken(uid));
  const session = { uid, email, displayName, app, auth, db: getFirestore(app), user: credential.user };
  sessions.push(session);
  return session;
}

async function seedUserSpace(session, role) {
  await adminDb.doc(`users/${session.uid}`).set({
    uid: session.uid,
    email: session.email,
    displayName: session.displayName,
    photoUrl: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  await adminDb.doc(`users/${session.uid}/familySpaces/${spaceId}`).set({
    familySpaceId: spaceId,
    name: "KinCue live check",
    timezone: "Asia/Calcutta",
    role,
    relationshipLabel: null,
    createdAt: Timestamp.now(),
  });
}

function careProfile(id, createdByUserId, fullName) {
  return {
    id,
    linkedMemberUserId: null,
    fullName,
    preferredName: null,
    relationshipLabel: null,
    careNeedsSummary: null,
    status: "active",
    createdByUserId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

async function api(session, path, init = {}) {
  const token = await session.user.getIdToken();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
  });
}

function vaultForm() {
  const form = new FormData();
  form.set("category", "other");
  form.set("description", "Temporary KinCue live integration file");
  form.set("file", new File([onePixelPng()], "kincue-live-check.png", { type: "image/png" }));
  return form;
}

function onePixelPng() {
  return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
}

function localDateTimeParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const number = (type) => Number(parts.find((part) => part.type === type)?.value);
  const year = number("year");
  const month = number("month");
  const day = number("day");
  return { year, month, day, hour: number("hour"), minute: number("minute"), weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

async function assertRejectsPermission(promise, message) {
  try {
    await promise;
  } catch (error) {
    if (String(error?.code || error).includes("permission-denied")) return;
    throw error;
  }
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup(label, promise) {
  try {
    await promise;
  } catch (error) {
    cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function pad(number) {
  return String(number).padStart(2, "0");
}

async function readEnvironmentFile(path) {
  try {
    const content = await readFile(path, "utf8");
    return new Map(content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map((line) => {
      const separator = line.indexOf("=");
      return separator < 1 ? null : [line.slice(0, separator), unquote(line.slice(separator + 1))];
    }).filter(Boolean));
  } catch {
    return new Map();
  }
}

function unquote(input) {
  const trimmed = input.trim();
  return trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
    ? trimmed.slice(1, -1)
    : trimmed;
}
