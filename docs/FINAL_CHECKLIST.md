# KinCue Final Checklist

Use only fake names and test files during this pass. A step is complete only
when the expected result is visible on both participating browser profiles.

## One-time configuration

- [ ] Google is enabled in Firebase Authentication.
- [ ] `localhost` and the final deployment domain are Firebase authorized domains.
- [ ] Firestore is Standard edition and the checked-in rules and indexes are deployed.
- [ ] `.env.local` contains the Firebase Web and Admin values.
- [ ] `.env.local` contains `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and
  `SUPABASE_STORAGE_BUCKET=kincue-vault` as server-only values.
- [ ] `OPENAI_API_KEY` is empty for zero-spend local handover extraction.
- [ ] `.env.local` and service-account files are absent from Git.

## Automated release gate

Run these commands from the project directory:

```powershell
npm run check:config
npm run check:vault
npm run check:live
npm run lint
npm test
```

Expected: Firebase and Supabase report ready, the Vault and authenticated live
checks succeed, lint exits cleanly, the production build succeeds, and all
tests pass. Run `check:live` only while KinCue is running on port 3004.

## Multi-account acceptance pass

- [ ] Account A creates a Family Space.
- [ ] Account A invites Account B as Primary caregiver and Account C as Helper or Viewer.
- [ ] B and C accept using the exact invited Google addresses.
- [ ] All accounts see the same members and no records from another Family Space.
- [ ] A creates a linked Care Profile and B sees it update in real time.
- [ ] A creates a scheduled routine with exact care instructions.
- [ ] A assigns a covering shift; B accepts it and receives the generated cue.
- [ ] Repeat once with B as primary and C as backup; C accepts and the cue is assigned to C.
- [ ] On desktop and phone-width views, the assigned caregiver enables notifications.
- [ ] A due cue produces both the red in-app alarm and a browser notification.
- [ ] Complete, Snooze, and Request help synchronize to the other account.
- [ ] A Playbook reminder appears in Today for its responsible member.
- [ ] A local-mode handover is structured, reviewed, saved, and visible to B.
- [ ] A fake image or PDF uploads to Vault; B can open it with a signed URL.
- [ ] Viewer cannot upload or delete; Owner or Primary caregiver can delete.
- [ ] Family Activity shows the correct actor for recent actions.
- [ ] Signing out removes all private family content from the screen.

Detailed field-by-field instructions are in `docs/TESTING.md`.

## Release evidence

- [ ] Capture one clean screenshot each of Today, Care, Home, Handover, and Vault.
- [ ] Capture the cross-device assignment and due-alarm moment.
- [ ] Record the final deployed URL and tested commit hash.
- [ ] Confirm screenshots contain no keys, private medical data, or real documents.
- [ ] Record every failure with account role, action, visible error, and screenshot.
