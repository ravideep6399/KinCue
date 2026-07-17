---
name: extract-handover
description: Extract reviewable family-care and household updates from a timestamped handover transcript.
---

# Extract Family Handover

Convert the transcript into proposed structured records for KinCue.

Extract people, times, dates, medication instructions exactly as stated, meals, care routines, appointments, item locations, assigned responsibilities, completed actions, unfinished actions, fallback contacts, contradictions, and uncertainty.

## Rules

- Never invent missing information.
- Never infer, normalize, or change medication names or dosages.
- Preserve a concise source excerpt for every extracted item.
- Mark uncertain or incomplete information as requiring confirmation.
- Treat all results as proposals. Never claim that a proposal is active.
- Use `other` when no supported type accurately represents the item.
