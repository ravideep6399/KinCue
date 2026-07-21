import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("defines the authenticated KinCue product shell", async () => {
  const [page, layout, app, today] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/KinCueApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/TodayDashboard.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /default: "KinCue"/);
  assert.match(page, /FirebaseAuthProvider/);
  assert.match(page, /FamilySpaceProvider/);
  assert.match(page, /FamilySpaceGate/);
  assert.match(today, /No cues scheduled/);
  assert.match(today, /Today&apos;s timeline/);
  assert.match(app, /mobile-only[^>]*title="Enable notifications"/);
  assert.doesNotMatch(app, /Sharma|Savitri|Priya|Aarav|Ananya/);
  assert.doesNotMatch(app, /codex-preview|react-loading-skeleton/i);
});

test("ships the runtime skill and removes starter preview files", async () => {
  const skill = await readFile(
    new URL("../src/ai/skills/extract-handover.md", import.meta.url),
    "utf8",
  );
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.match(skill, /Never invent missing information/);
  assert.match(skill, /Never infer, normalize, or change medication/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", root)));
});

test("ships a Firebase auth boundary and family-scoped security rules", async () => {
  const [auth, rules, environment, packageJson] = await Promise.all([
    readFile(new URL("../app/FirebaseAuth.tsx", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(auth, /GoogleAuthProvider/);
  assert.match(auth, /signInWithPopup/);
  assert.match(auth, /browserLocalPersistence/);
  assert.doesNotMatch(auth, /isDemo|demoIdentity|Aarav/);
  assert.match(rules, /function isMember\(spaceId\)/);
  assert.match(rules, /match \/invitations\/\{invitationId\}/);
  assert.match(environment, /FIREBASE_PRIVATE_KEY=/);
  assert.doesNotMatch(environment, /NEXT_PUBLIC_FIREBASE_PRIVATE_KEY/);
  assert.match(packageJson, /"firebase"/);
  assert.match(packageJson, /"firebase-admin"/);
  assert.match(packageJson, /"dev": "next dev"/);
  assert.doesNotMatch(packageJson, /vinext|drizzle/i);
  await assert.rejects(access(new URL("../app/chatgpt-auth.ts", root)));
  await assert.rejects(access(new URL("../drizzle.config.ts", root)));
});

test("creates secure owner-controlled family invitation links", async () => {
  const [createRoute, acceptanceRoute, members] = await Promise.all([
    readFile(new URL("../app/api/family-spaces/[spaceId]/invitations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invitations/[token]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/FamilyMembers.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(createRoute, /randomBytes\(32\)/);
  assert.match(createRoute, /createHash\("sha256"\)/);
  assert.match(createRoute, /role !== "owner"/);
  assert.match(acceptanceRoute, /inviteeEmail !== identity\.email/);
  assert.match(acceptanceRoute, /runTransaction/);
  assert.match(members, /subscribeToFamilyMembers/);
});

test("persists user-created care profiles without seeded people", async () => {
  const [view, data, rules] = await Promise.all([
    readFile(new URL("../app/CareProfiles.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/firebase/care-profiles.ts", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);

  assert.match(view, /Create care profile/);
  assert.match(view, /activeSpace\?\.role === "primary_caregiver"/);
  assert.match(data, /subscribeToCareProfiles/);
  assert.match(data, /serverTimestamp\(\)/);
  assert.match(rules, /function validCareProfile\(spaceId, data\)/);
  assert.match(view, /Household account/);
  assert.match(data, /linkedMemberUserId/);
  assert.match(rules, /request\.resource\.data\.createdByUserId == request\.auth\.uid/);
  assert.doesNotMatch(`${view}\n${data}`, /Sharma|Savitri|Priya|Aarav|Ananya/);
});

test("stores structured care routines for later cue generation", async () => {
  const [view, data, rules] = await Promise.all([
    readFile(new URL("../app/CareRoutines.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/firebase/care-routines.ts", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);

  assert.match(view, /Exact instructions/);
  assert.match(view, /Reminder days/);
  assert.match(data, /where\("careProfileId", "==", careProfileId\)/);
  assert.match(rules, /function validCareRoutine\(spaceId, data\)/);
  assert.match(rules, /data\.daysOfWeek\.hasOnly\(\[0, 1, 2, 3, 4, 5, 6\]\)/);
});

test("supports cross-device care shift assignment and responses", async () => {
  const [view, data, rules] = await Promise.all([
    readFile(new URL("../app/CareShifts.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/firebase/care-shifts.ts", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);

  assert.match(view, /Primary caregiver/);
  assert.match(view, /Accept shift/);
  assert.match(data, /subscribeToCareShifts/);
  assert.match(data, /acceptedByUserId/);
  assert.match(rules, /function validCareShift\(spaceId, data\)/);
  assert.match(rules, /request\.resource\.data\.acceptedByUserId == request\.auth\.uid/);
});

test("generates persistent scheduled cue occurrences with alarm states", async () => {
  const [dashboard, syncRoute, data, rules] = await Promise.all([
    readFile(new URL("../app/TodayDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/family-spaces/[spaceId]/cues/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/firebase/cue-occurrences.ts", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /new Notification/);
  assert.match(dashboard, /alarm-band/);
  assert.match(syncRoute, /zonedDateTimeToUtc/);
  assert.match(syncRoute, /todayKey/);
  assert.match(syncRoute, /No accepted care shift covers this time/);
  assert.match(syncRoute, /findCoveringShift\(shifts, routine\.careProfileId/);
  assert.match(syncRoute, /acceptedByUserId/);
  assert.match(data, /completeCue/);
  assert.match(data, /snoozeCue/);
  assert.match(dashboard, /dateKeyInZone/);
  assert.match(rules, /function validCueOccurrence\(data\)/);
  assert.match(rules, /allow create, delete: if false/);
  assert.match(rules, /match \/cues\/\{cueId\}[\s\S]*?allow create, update, delete: if false/);
  assert.match(rules, /match \/deviceTokens\/\{tokenId\}[\s\S]*?allow read, create, update, delete: if false/);
  assert.match(syncRoute, /bulkWriter\(\)/);
  assert.match(syncRoute, /writer\.delete\(existingOccurrence\.ref\)/);
});

test("persists Home Playbook knowledge and promotes reminders into cues", async () => {
  const [view, data, syncRoute, rules] = await Promise.all([
    readFile(new URL("../app/HomePlaybook.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/firebase/playbook.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/family-spaces/[spaceId]/cues/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);

  assert.match(view, /One-time reminder/);
  assert.match(data, /subscribeToPlaybookEntries/);
  assert.match(syncRoute, /playbookProposals/);
  assert.match(rules, /function validPlaybookEntry\(spaceId, data\)/);
});

test("saves reviewed AI handovers as family history", async () => {
  const [view, data, route, rules] = await Promise.all([
    readFile(new URL("../app/HandoverWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/firebase/handovers.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/handovers/extract/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);
  assert.match(view, /Confirm and save/);
  assert.match(data, /subscribeToHandovers/);
  assert.match(route, /membership\.data\(\)\?\.role === "viewer"/);
  assert.match(route, /GEMINI_API_KEY/);
  assert.match(route, /extractHandoverWithGemini/);
  assert.match(rules, /function validHandover\(data\)/);
  assert.match(rules, /allow update: if false/);
});

test("uses authenticated API routes and private Supabase Storage for Vault files", async () => {
  const [view, data, uploadRoute, documentRoute, firestoreRules, environment] = await Promise.all([
    readFile(new URL("../app/FamilyVault.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/firebase/vault.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/family-spaces/[spaceId]/vault/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/family-spaces/[spaceId]/vault/[documentId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(view, /Upload to Vault/);
  assert.match(data, /authorization: `Bearer \$\{accessToken\}`/);
  assert.match(uploadRoute, /membership\.data\(\)\?\.role === "viewer"/);
  assert.match(uploadRoute, /getSupabaseAdmin\(\)\.storage/);
  assert.match(documentRoute, /createSignedUrl\(storagePath, 60\)/);
  assert.match(documentRoute, /\["owner", "primary_caregiver"\]/);
  assert.match(firestoreRules, /allow create, update, delete: if false/);
  assert.match(environment, /SUPABASE_SECRET_KEY=/);
  assert.doesNotMatch(environment, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
});

test("records immutable family activity events", async () => {
  const [view, data, rules] = await Promise.all([
    readFile(new URL("../app/FamilyActivity.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/firebase/activity.ts", import.meta.url), "utf8"),
    readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
  ]);
  assert.match(view, /Family activity/);
  assert.match(data, /orderBy\("createdAt", "desc"\)/);
  assert.match(rules, /function validActivityEvent\(data\)/);
  assert.match(rules, /allow update, delete: if false/);
});
