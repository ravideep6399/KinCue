import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import {
  authenticateFirebaseRequest,
  FirebaseRequestError,
  getFirebaseAdmin,
} from "../../../../../../src/firebase/admin";
import {
  assignedCaregiverForShift,
  findCoveringShift,
} from "../../../../../../src/time/cue-assignment";

type RoutineRecord = {
  id: string;
  careProfileId: string;
  title: string;
  instructions: string;
  importance: string;
  timeOfDay: string | null;
  daysOfWeek: number[];
  active: boolean;
};

type ShiftRecord = {
  id: string;
  careProfileId: string;
  primaryUserId: string;
  acceptedByUserId: string | null;
  startsAt: Timestamp;
  endsAt: Timestamp;
  status: string;
};

type PlaybookRecord = {
  id: string;
  title: string;
  details: string;
  reminderAt: Timestamp | null;
  assignedUserId: string | null;
  active: boolean;
};

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ spaceId: string }> },
) {
  try {
    const identity = await authenticateFirebaseRequest(request);
    const { spaceId } = await context.params;
    const { db } = getFirebaseAdmin();
    const [space, membership, routineSnapshot, shiftSnapshot, playbookSnapshot] = await Promise.all([
      db.doc(`familySpaces/${spaceId}`).get(),
      db.doc(`familySpaces/${spaceId}/members/${identity.uid}`).get(),
      db.collection(`familySpaces/${spaceId}/instructions`).where("active", "==", true).get(),
      db.collection(`familySpaces/${spaceId}/careShifts`).get(),
      db.collection(`familySpaces/${spaceId}/playbookEntries`).where("active", "==", true).get(),
    ]);

    if (!space.exists || !membership.exists) {
      return NextResponse.json({ error: "Family Space access is required." }, { status: 403 });
    }

    const timezone = space.data()?.timezone;
    if (typeof timezone !== "string" || !timezone) {
      return NextResponse.json({ error: "The Family Space timezone is missing." }, { status: 409 });
    }

    const routines = routineSnapshot.docs
      .map((item) => item.data() as RoutineRecord)
      .filter((routine) => routine.timeOfDay && routine.daysOfWeek.length > 0);
    const shifts = shiftSnapshot.docs
      .map((item) => item.data() as ShiftRecord)
      .filter((shift) => shift.status === "accepted" || shift.status === "active")
      .map((shift) => ({
        id: shift.id,
        careProfileId: shift.careProfileId,
        assignedUserId: assignedCaregiverForShift(
          shift.primaryUserId,
          shift.acceptedByUserId,
        ),
        startsAtMillis: shift.startsAt.toMillis(),
        endsAtMillis: shift.endsAt.toMillis(),
      }));
    const now = new Date();
    const localToday = datePartsInZone(now, timezone);
    const routineProposals = routines.flatMap((routine) =>
      Array.from({ length: 8 }, (_, index) => {
        const offset = index - 1;
        const date = addCalendarDays(localToday, offset);
        const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
        if (!routine.daysOfWeek.includes(weekday) || !routine.timeOfDay) return null;
        const [hour, minute] = routine.timeOfDay.split(":").map(Number);
        const scheduled = zonedDateTimeToUtc({ ...date, hour, minute }, timezone);
        const shift = findCoveringShift(shifts, routine.careProfileId, scheduled.getTime());
        const dateKey = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
        return {
          id: `${routine.id}_${dateKey}_${pad(hour)}${pad(minute)}`,
          cueId: routine.id,
          careProfileId: routine.careProfileId,
          title: routine.title,
          instructions: routine.instructions,
          importance: routine.importance,
          scheduled,
          shiftId: shift?.id ?? null,
          assignedUserId: shift?.assignedUserId ?? null,
        };
      }).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    );
    const playbookProposals = playbookSnapshot.docs
      .map((item) => item.data() as PlaybookRecord)
      .filter((entry) => entry.reminderAt && entry.reminderAt.toMillis() >= now.getTime() - 86400000 && entry.reminderAt.toMillis() <= now.getTime() + 7 * 86400000)
      .map((entry) => ({
        id: `home_${entry.id}_${entry.reminderAt!.toMillis()}`,
        cueId: entry.id,
        careProfileId: null,
        title: entry.title,
        instructions: entry.details,
        importance: "routine",
        scheduled: entry.reminderAt!.toDate(),
        shiftId: null,
        assignedUserId: entry.assignedUserId,
      }));
    const proposals = [...routineProposals, ...playbookProposals];

    const occurrenceWindow = await db.collection(`familySpaces/${spaceId}/cueOccurrences`)
      .where("scheduledAt", ">=", Timestamp.fromMillis(now.getTime() - 86400000))
      .where("scheduledAt", "<=", Timestamp.fromMillis(now.getTime() + 7 * 86400000))
      .get();
    const existingById = new Map(occurrenceWindow.docs.map((snapshot) => [snapshot.id, snapshot]));
    const proposedIds = new Set(proposals.map((proposal) => proposal.id));
    const writer = db.bulkWriter();

    for (const existingOccurrence of occurrenceWindow.docs) {
      const existingData = existingOccurrence.data();
      if (
        !proposedIds.has(existingOccurrence.id) &&
        existingData.scheduledAt.toMillis() > now.getTime() &&
        !["completed", "skipped"].includes(existingData.status)
      ) {
        writer.delete(existingOccurrence.ref);
      }
    }

    for (const proposal of proposals) {
      const ref = db.doc(`familySpaces/${spaceId}/cueOccurrences/${proposal.id}`);
      const snapshot = existingById.get(proposal.id);
      const assignedUserId = proposal.assignedUserId;
      if (!snapshot?.exists) {
        writer.set(ref, {
          id: proposal.id,
          cueId: proposal.cueId,
          careProfileId: proposal.careProfileId,
          shiftId: proposal.shiftId,
          title: proposal.title,
          instructions: proposal.instructions,
          importance: proposal.importance,
          assignedUserId,
          scheduledAt: Timestamp.fromDate(proposal.scheduled),
          status: occurrenceStatus(proposal.scheduled, assignedUserId, now),
          acknowledgedAt: null,
          snoozedUntil: null,
          blockedReason: assignedUserId ? null : "No accepted care shift covers this time.",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        continue;
      }

      const data = snapshot.data()!;
      if (["completed", "skipped"].includes(data.status)) continue;
      const snoozed = data.status === "snoozed" && data.snoozedUntil?.toMillis() > now.getTime();
      const nextStatus = snoozed ? "snoozed" : occurrenceStatus(proposal.scheduled, assignedUserId, now);
      const nextBlockedReason = assignedUserId ? null : "No accepted care shift covers this time.";
      const changed =
        data.assignedUserId !== assignedUserId ||
        data.shiftId !== proposal.shiftId ||
        data.status !== nextStatus ||
        data.blockedReason !== nextBlockedReason ||
        (!snoozed && data.snoozedUntil != null);
      if (!changed) continue;
      writer.update(ref, {
        assignedUserId,
        shiftId: proposal.shiftId,
        status: nextStatus,
        blockedReason: nextBlockedReason,
        ...(!snoozed ? { snoozedUntil: null } : {}),
        updatedAt: Timestamp.now(),
      });
    }

    await writer.close();
    return NextResponse.json({
      synced: proposals.length,
      todayKey: `${localToday.year}-${pad(localToday.month)}-${pad(localToday.day)}`,
    });
  } catch (error) {
    if (error instanceof FirebaseRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Could not sync cue occurrences", error);
    return NextResponse.json({ error: "Scheduled cues could not be synchronized." }, { status: 500 });
  }
}

function occurrenceStatus(scheduled: Date, assignedUserId: string | null, now: Date) {
  if (!assignedUserId) return "blocked";
  if (scheduled.getTime() > now.getTime()) return "upcoming";
  return now.getTime() - scheduled.getTime() > 30 * 60 * 1000 ? "overdue" : "due";
}

function datePartsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function addCalendarDays(date: { year: number; month: number; day: number }, offset: number) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + offset));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function zonedDateTimeToUtc(
  value: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
) {
  const desired = Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute);
  let candidate = new Date(desired);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(candidate);
    const number = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const represented = Date.UTC(number("year"), number("month") - 1, number("day"), number("hour"), number("minute"));
    candidate = new Date(candidate.getTime() + desired - represented);
  }
  return candidate;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
