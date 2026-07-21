# KinCue Video and Submission Prep

## One-line pitch

KinCue gives a family one private, shared operating space for care routines,
caregiver handoffs, household knowledge, reminders, and important documents.

## Submission description

KinCue is an Apps for Your Life web app that prevents family care and household
knowledge from living in one person's memory. Family members coordinate linked
care recipients, assign cross-device care shifts, receive scheduled alarms,
save reviewed AI-assisted handovers, maintain a household Playbook, and access
private files through short-lived signed links. Its AI workflow is conservative:
it preserves source details, identifies missing information, and requires human
confirmation before saving; the demo can run in a zero-spend local mode.

## Three-minute demo sequence

1. **Problem, 0:00-0:20**
   Explain that routines, medicine context, household instructions, and files
   often depend on one busy family member.
2. **Family Space, 0:20-0:45**
   Show Google sign-in, members, roles, and a linked care recipient.
3. **Assignment and alarm, 0:45-1:30**
   Assign a shift on Account A, accept on Account B, then show the synchronized
   cue and due alarm on the assigned caregiver's device.
4. **Continuity tools, 1:30-2:15**
   Show an exact care routine, a Playbook location/reminder, and a reviewed
   handover extracted from a short caregiver update.
5. **Private Vault and trust, 2:15-2:40**
   Open a fake document through a signed URL and briefly show role restrictions.
6. **Close, 2:40-3:00**
   Return to Today and state that KinCue turns scattered family knowledge into
   an accountable, shared continuity system.

## Recording setup

- Use two browser profiles side by side and phone-width responsive view for the caregiver.
- Seed only a small, coherent fictional family story before recording.
- Schedule the demo cue two or three minutes ahead and rehearse its timing once.
- Keep notifications enabled and close unrelated tabs and personal bookmarks.
- Zoom the browser only enough for readable text; do not expose consoles or environment files.
- Record one uninterrupted main take, then capture clean fallback clips of the alarm and Vault.

## Submission fields to finalize after deployment

- Project name: KinCue
- Hackathon category: Apps for Your Life
- Public application URL
- Source repository URL
- Demo video URL
- Short description based on the text above
- Technologies: Next.js, React, TypeScript, Firebase Auth and Firestore,
  Supabase Storage, optional OpenAI Responses API, Markdown extraction skill
- Privacy note: private family membership, role-based Firestore rules,
  server-only storage secret, private bucket, and expiring signed file URLs
