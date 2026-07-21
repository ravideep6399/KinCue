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

## Three-minute recording script

Use the quoted text as narration and perform the action written above it.

### 0:00-0:18 - The problem

**Screen:** Start on KinCue's Today view with the family name, current member,
and today's timeline visible.

> In many families, one person remembers every routine, appointment, document,
> and household detail. When that person becomes busy or unavailable, care does
> not fail because nobody cares. It fails because context was never shared.

### 0:18-0:38 - One private Family Space

**Screen:** Open Members. Show two fictional members with different roles, then
open Care and show that a household member can also be a person receiving care.

> KinCue gives the household one private Family Space. Every person signs in
> with their own Google account, receives a role, and can be connected to the
> people they help. A family member can also become a care recipient without
> creating a duplicate identity.

### 0:38-1:08 - Routine, shift, and cross-device response

**Screen:** Open Meera's routines and briefly show the labeled hour, minute, and
AM/PM controls. On the owner browser, show a shift assigned to a primary and
backup caregiver. On the second browser, accept it. Return to the owner browser
and show `Accepted by <name>`.

> Here is Meera's evening routine, including its exact time, importance, source
> instructions, and location. A parent can assign a care shift from one device.
> The assigned caregiver responds from their own device, and every family view
> updates from Firestore in real time. This is one shared shift, so the first
> acceptance establishes coverage for everyone.

### 1:08-1:30 - Alarm and accountability

**Screen:** Return to Today. Show a due cue or a prepared screenshot/clip of the
due state and browser notification. Complete the cue and show its state update.

> Scheduled routines become persistent cues, not temporary browser timers.
> KinCue identifies who is covering the shift, raises an in-app alarm and browser
> notification while the app is open, and records completion in Family Activity.
> If nobody accepts coverage, the cue is visibly blocked instead of silently
> assigning responsibility.

### 1:30-1:52 - Home Playbook

**Screen:** Open Playbook and select `Medicine box location`. Show its location,
instructions, owner, and reminder fields.

> Care is only part of family continuity. The Home Playbook captures knowledge
> such as where an item is kept, who handles a bill, or what to do during an
> outage. Entries are searchable, assignable, and can create scheduled cues.

### 1:52-2:28 - Handover extraction without API credit

**Screen:** Open Handover and enter this fictional transcript:

`Meera took the blue vitamin tablet at 8 PM after dinner. The bottle is in the
upper kitchen cabinet. Her clinic appointment is tomorrow, but the time was not
confirmed.`

Click **Structure handover**. Show the proposed items, warning or unresolved
question, source excerpts, `Local fallback` label, and human confirmation step.

> A caregiver can turn an unstructured update into a reviewable briefing.
> KinCue's server pipeline is built for the OpenAI Responses API with GPT-5.6, a
> Markdown extraction skill, and a typed structured-output schema. This demo
> project currently has no paid API quota, so KinCue says so clearly and uses its
> conservative local fallback. The contract stays the same: preserve source
> evidence, flag missing details, and never save anything until a person confirms
> it.

### 2:28-2:48 - Private Vault

**Screen:** Open Vault and show one fictional non-sensitive document. Open it,
then return to the document list.

> Important files live in a private Supabase bucket. KinCue verifies Firebase
> identity and Family Space permissions on the server before issuing a short-lived
> signed link. Storage credentials never reach the browser.

### 2:48-3:00 - Close

**Screen:** Return to Today with the timeline, coverage, and recent activity in
one frame.

> KinCue turns scattered family memory into shared, accountable continuity: the
> right instruction, for the right person, at the right time.

End on the KinCue interface for two seconds. Do not end on source code or a
terminal.

## Fictional demo data

- Family Space: `Singh Family`
- Care recipient: `Meera Singh`
- Primary caregiver: `Asha Singh`
- Backup caregiver: `Ravi Singh`
- Routine: `Evening vitamin`, `8:00 PM`, after dinner, high importance
- Playbook entry: `Medicine box location`, upper kitchen cabinet
- Vault file: a clearly fictional appointment checklist with no private data
- Shift: begin it shortly before recording so its cue can become due on camera

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
