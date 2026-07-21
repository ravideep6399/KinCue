# KinCue

KinCue is a private family continuity workspace for coordinating care,
household knowledge, reminders, handovers, and documents across devices.

## Product scope

- Google sign-in and private Family Spaces
- Email-specific member invitation links and household roles
- Care Profiles optionally linked to signed-in household members
- Structured care routines with categories, importance, times, and weekdays
- Cross-device caregiver shift assignment, acceptance, and completion
- Server-generated cue occurrences with due, overdue, snoozed, blocked, and
  completed states
- In-app alarm indication and browser notifications while KinCue is open
- Home Playbook entries with locations, assignees, and one-time reminders
- AI-assisted handover extraction, human review, and saved history
- Private family Vault backed by Supabase Storage
- Immutable Family Activity history

KinCue does not seed demo people, schedules, medicines, contacts, files, or
household records. A configured Firebase project is required.

## Stack

- Next.js, React, and TypeScript
- Firebase Authentication with Google
- Cloud Firestore for private realtime family data
- Supabase Storage free tier for private family files
- Optional OpenAI Responses API with a zero-spend local extraction fallback
- Markdown runtime skill instructions for conservative handover extraction

## Local development

Requirements:

- Node.js 22.13 or newer
- A Firebase project with a registered Web app
- Firebase Admin service-account credentials
- A free Supabase project for Vault uploads

```powershell
cd "C:\Users\ravid\OneDrive\Documents\Open Ai HackaThon"
npm install
npm run dev -- -p 3004
```

Open `http://localhost:3004`. Stop the server with `Ctrl+C`.

## Environment

Copy `.env.example` to `.env.local` and fill every Firebase value. Values
starting with `NEXT_PUBLIC_` identify the Firebase Web app and are expected in
the browser bundle. The following values are server-only secrets:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `OPENAI_API_KEY`

Never commit `.env.local`, service-account JSON, private keys, or API keys.

## Firebase configuration

1. Enable Google in Authentication > Sign-in method.
2. Add `localhost` and the production domain to Authentication > Settings >
   Authorized domains.
3. Create a Standard edition Firestore database.
4. Deploy the checked-in Firestore indexes and rules:

```powershell
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project kincue-24ee5
```

## Free Vault configuration

1. Create a Supabase Free project.
2. Open Storage and create a **private** bucket named `kincue-vault`.
3. In the Supabase project settings, copy the project URL and server-side
   Secret key (`sb_secret_...`) into `SUPABASE_URL` and
   `SUPABASE_SECRET_KEY` in `.env.local`.
4. Keep `SUPABASE_STORAGE_BUCKET=kincue-vault`.

Create or correct the bucket restrictions, then verify a signed file round trip:

```powershell
npm run setup:vault
```

Do not make the bucket public and never expose the Secret key through a
`NEXT_PUBLIC_` variable. KinCue verifies Firebase authentication and Family
Space roles in its server routes before creating a one-minute signed download
URL.

Validate the local configuration without displaying any secret values:

```powershell
npm run check:config
npm run check:vault
```

## Zero-spend handover extraction

Leave `OPENAI_API_KEY` empty to use KinCue's conservative local extraction.
It recognizes common medication, appointment, task, and item-location details,
preserves source text, and requires human confirmation. Adding an OpenAI API
key later enables model-backed structured extraction without changing saved
handover records.

Browser notification permission must be enabled separately on every caregiver
device. The current reminder delivery runs while KinCue is open; a future
production background-push service can use the same persistent cue records.

## Roles

| Capability | Owner | Primary caregiver | Helper | Viewer |
| --- | --- | --- | --- | --- |
| Invite members | Yes | No | No | No |
| Create/edit Care Profiles | Yes | Yes | No | No |
| Create/edit routines and shifts | Yes | Yes | No | No |
| Respond to assigned shifts/cues | Yes | Yes | Yes | Read only |
| Add Playbook entries and handovers | Yes | Yes | Yes | Read only |
| Upload Vault files | Yes | Yes | Yes | Read only |
| Delete Vault files | Yes | Yes | No | No |

## Verification

```powershell
npm run check:config
npm run check:vault
npm run check:live
npm run lint
npm test
```

`check:live` requires KinCue to be running at `http://localhost:3004`. It creates
isolated temporary Firebase users and a temporary Family Space, verifies the
deployed role rules and authenticated API workflows, and removes its test data.

The complete manual test and account-setup sequence is in
[`docs/TESTING.md`](docs/TESTING.md).
Use [`docs/FINAL_CHECKLIST.md`](docs/FINAL_CHECKLIST.md) for the final release
gate and [`docs/VIDEO_AND_SUBMISSION.md`](docs/VIDEO_AND_SUBMISSION.md) when the
deployed build is ready to record.
