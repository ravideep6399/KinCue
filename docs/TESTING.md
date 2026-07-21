# KinCue End-to-End Test

Run this test only after the production build and Firebase rules deployment
complete successfully.

Before the Vault section, create the private `kincue-vault` bucket in a free
Supabase project and add the server-only Supabase values from `.env.example` to
`.env.local`. Use only small, fake test files.

Run `npm run check:config` before starting KinCue. It must report Firebase and
the Supabase private Vault as configured, and handovers as local zero-spend mode
when `OPENAI_API_KEY` is empty.
Then run `npm run check:vault`; it must verify a private signed upload/download
round trip and remove its temporary one-pixel image.

## Accounts and devices

Prepare three Google accounts or browser profiles:

- Account A: Family Space owner
- Account B: Primary caregiver
- Account C: Helper or viewer

Use separate normal/private browser windows to represent different devices.

## Owner setup

1. Start KinCue with `npm run dev -- -p 3004`.
2. Open `http://localhost:3004` and sign in as Account A.
3. Create a new Family Space using a test-only name.
4. Open Family members and create an invitation for Account B with the Primary
   caregiver role.
5. Open the invitation in a separate browser profile, sign in with the exact
   invited email, and accept it.
6. Repeat for Account C using Helper or Viewer.
7. Confirm every device shows the same Family Space and member list.

## Care Profile and account link

1. As Account A, open Care and create a Care Profile.
2. Select Account B under Household account to test a linked care recipient.
3. Confirm the profile appears immediately on Accounts A and B.
4. Edit the preferred name or care context and refresh both devices.
5. Confirm the update persists and only one profile can link to Account B.

## Routines, shifts, and alarms

1. Open the profile's routines using the book icon.
2. Create a routine with exact instructions, a reminder time a few minutes in
   the future, and today's weekday.
3. Assign a care shift covering that reminder time to Account B, with Account C
   as backup.
4. On Account B, accept the pending shift.
5. Open Today. Wait for or refresh the cue synchronization.
6. Confirm the cue is assigned to Account B and appears on all devices.
7. Enable notifications on Account B.
8. When the cue becomes due, confirm the red in-app alarm band and browser
   notification appear on Account B.
9. Test Snooze, Complete, and Request help on separate cue occurrences.
10. Confirm status changes appear on the other devices without refreshing.

## Home Playbook

1. Create entries in two different categories.
2. Add a location to one entry.
3. Add a near-future reminder and responsible member to another entry.
4. Confirm the reminder appears in Today and uses the selected member.
5. Edit an entry and verify the change on a second device.

## AI handover

1. Open Handover as Account A or B.
2. Type a realistic update longer than 12 characters, or use Record in a
   browser that supports speech recognition.
3. Select Structure handover.
4. Confirm missing people, times, medicine details, or locations are shown as
   missing rather than invented.
5. Review the source-preserved extraction and select Confirm and save.
6. Confirm the saved summary appears under Recent handovers on another device.
7. With `OPENAI_API_KEY` empty, confirm the request succeeds in local extraction
   mode without creating any OpenAI API cost.

## Vault

1. Upload an image or PDF smaller than 10 MB.
2. Confirm the file metadata appears on all member devices.
3. Open the file from Account B and confirm its signed URL expires rather than
   exposing a public bucket URL.
4. Confirm a Viewer can read but cannot upload or delete.
5. Delete the file as Owner or Primary caregiver and confirm it disappears.
6. Confirm unsupported file types and files at or above 10 MB are rejected.

## Roles, isolation, and activity

1. Confirm Helper cannot create Care Profiles, routines, or shifts.
2. Confirm Viewer sees no create/edit/upload controls.
3. Create a second Family Space and confirm records never cross spaces.
4. Open Family activity and confirm recent actions show the correct actor.
5. Sign out and confirm private Family Space content is no longer visible.

## Automated checks

```powershell
npm run check:config
npm run check:vault
npm run lint
npm test
```

Record any failed step with the account role, browser, exact action, visible
error, and screenshot. Do not include API keys, Firebase private keys, medical
documents, or real personal information in bug reports or submission media.
