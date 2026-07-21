"use client";

import { CalendarClock, Check, Plus, UserRoundCheck, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  createCareShift,
  subscribeToCareShifts,
  updateCareShiftStatus,
  type CareShiftInput,
} from "../src/firebase/care-shifts";
import type { CareProfile, CareShift, CareShiftStatus, FamilyMember } from "../src/firebase/models";
import { useKinCueAuth } from "./FirebaseAuth";
import { useFamilySpace } from "./FamilySpace";
import { recordActivity } from "../src/firebase/activity";
import { formatInTimeZone } from "../src/time/timezone";

const emptyShift: CareShiftInput = {
  careProfileId: "",
  title: "",
  primaryUserId: "",
  backupUserId: "",
  startsAt: "",
  endsAt: "",
  acceptanceDeadline: "",
};

export function CareShifts({
  profiles,
  members,
  canCoordinate,
  notify,
}: {
  profiles: CareProfile[];
  members: FamilyMember[];
  canCoordinate: boolean;
  notify: (message: string) => void;
}) {
  const { identity } = useKinCueAuth();
  const { activeSpace } = useFamilySpace();
  const [shifts, setShifts] = useState<CareShift[]>([]);
  const [loadedSpaceId, setLoadedSpaceId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CareShiftInput>(emptyShift);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = loadedSpaceId !== activeSpace?.familySpaceId;
  const eligibleMembers = members.filter((member) => member.role !== "viewer");

  useEffect(() => {
    if (!activeSpace) return;
    const familySpaceId = activeSpace.familySpaceId;
    return subscribeToCareShifts(
      familySpaceId,
      (nextShifts) => {
        setShifts(nextShifts);
        setLoadedSpaceId(familySpaceId);
        setError(null);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoadedSpaceId(familySpaceId);
      },
    );
  }, [activeSpace]);

  function memberName(userId: string | null) {
    return members.find((member) => member.userId === userId)?.displayName ?? "Unknown member";
  }

  function profileName(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    return profile?.preferredName || profile?.fullName || "Care profile";
  }

  function openCreate() {
    setForm({ ...emptyShift, careProfileId: profiles[0]?.id ?? "" });
    setError(null);
    setDialogOpen(true);
  }

  async function saveShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSpace || !identity || !form.careProfileId || !form.primaryUserId) return;
    if (form.backupUserId && form.backupUserId === form.primaryUserId) {
      setError("Primary and backup caregivers must be different members.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createCareShift(activeSpace.familySpaceId, identity.uid, activeSpace.timezone, form);
      void recordActivity(activeSpace.familySpaceId, identity, "care_shift_assigned", `Assigned care shift: ${form.title.trim()}`);
      setDialogOpen(false);
      notify("Care shift assigned.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The shift could not be assigned.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(shift: CareShift, status: CareShiftStatus) {
    if (!activeSpace || !identity) return;
    try {
      const resultingStatus = await updateCareShiftStatus(activeSpace.familySpaceId, shift.id, status, identity.uid);
      void recordActivity(activeSpace.familySpaceId, identity, "care_shift_status", `${status[0].toUpperCase()}${status.slice(1)} shift: ${shift.title}`);
      notify(
        status === "declined" && resultingStatus === "pending"
          ? "Your decline was recorded. The other caregiver can still respond."
          : status === "declined"
            ? "All assigned caregivers declined this shift."
            : `Shift ${status}.`,
      );
    } catch (statusError) {
      notify(statusError instanceof Error ? statusError.message : "The shift status could not be changed.");
    }
  }

  return (
    <div className="panel shift-panel">
      <div className="panel-header">
        <h3>Care shifts</h3>
        {canCoordinate && (
          <button className="secondary-button compact-button" disabled={profiles.length === 0 || members.length === 0} onClick={openCreate} type="button">
            <Plus size={15} /> Assign shift
          </button>
        )}
      </div>
      {loading ? (
        <ShiftEmpty title="Loading shifts..." />
      ) : shifts.length === 0 ? (
        <ShiftEmpty title="No care shifts" />
      ) : (
        <ul className="shift-list">
          {shifts.map((shift) => {
            const isAssignee = identity?.uid === shift.primaryUserId || identity?.uid === shift.backupUserId;
            const hasDeclined = identity?.uid === shift.declinedByUserId;
            return (
              <li key={shift.id}>
                <div className="shift-date"><strong>{formatDate(shift.startsAt, activeSpace?.timezone)}</strong><span>{formatTimeRange(shift.startsAt, shift.endsAt, activeSpace?.timezone)}</span></div>
                <div className="shift-copy"><strong>{shift.title}</strong><span>{profileName(shift.careProfileId)} | {memberName(shift.primaryUserId)}{shift.backupUserId ? ` | Backup: ${memberName(shift.backupUserId)}` : ""}</span>{shift.acceptedByUserId && <span className="shift-accepted-note">{shift.acceptedByUserId === identity?.uid ? "Accepted by you" : `Accepted by ${memberName(shift.acceptedByUserId)}`}</span>}{shift.status === "pending" && shift.declinedByUserId && <span className="shift-response-note">{memberName(shift.declinedByUserId)} declined; waiting for the other caregiver.</span>}</div>
                <span className={`status-pill ${shift.status}`}>{shift.status === "pending" && shift.declinedByUserId ? "awaiting response" : shift.status}</span>
                {isAssignee && !hasDeclined && shift.status === "pending" && (
                  <div className="shift-response-actions">
                    <button className="icon-button accept-button" onClick={() => void changeStatus(shift, "accepted")} title="Accept shift" type="button"><Check size={16} /></button>
                    <button className="icon-button decline-button" onClick={() => void changeStatus(shift, "declined")} title="Decline shift" type="button"><X size={16} /></button>
                  </div>
                )}
                {canCoordinate && shift.status === "accepted" && <button className="secondary-button compact-button" onClick={() => void changeStatus(shift, "active")} type="button">Start</button>}
                {canCoordinate && shift.status === "active" && <button className="secondary-button compact-button" onClick={() => void changeStatus(shift, "completed")} type="button">Complete</button>}
              </li>
            );
          })}
        </ul>
      )}
      {error && !dialogOpen && !loading && <p className="panel-error" role="alert">{error}</p>}

      {dialogOpen && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setDialogOpen(false)} role="presentation">
          <section aria-labelledby="shift-dialog-title" aria-modal="true" className="member-dialog shift-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <header className="dialog-header"><div><p className="eyebrow">Care coverage</p><h2 id="shift-dialog-title">Assign care shift</h2></div><button className="icon-button" disabled={saving} onClick={() => setDialogOpen(false)} title="Close" type="button"><X size={18} /></button></header>
            <form className="profile-form" onSubmit={saveShift}>
              <label htmlFor="shift-profile">Person receiving care</label>
              <select id="shift-profile" onChange={(event) => setForm((current) => ({ ...current, careProfileId: event.target.value }))} required value={form.careProfileId}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.preferredName || profile.fullName}</option>)}</select>
              <label htmlFor="shift-title">Shift title</label>
              <input id="shift-title" maxLength={100} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} />
              <div className="profile-form-grid">
                <div><label htmlFor="shift-primary">Primary caregiver</label><select id="shift-primary" onChange={(event) => setForm((current) => ({ ...current, primaryUserId: event.target.value }))} required value={form.primaryUserId}><option value="">Select member</option>{eligibleMembers.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</select></div>
                <div><label htmlFor="shift-backup">Backup caregiver</label><select id="shift-backup" onChange={(event) => setForm((current) => ({ ...current, backupUserId: event.target.value }))} value={form.backupUserId}><option value="">No backup</option>{eligibleMembers.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</select></div>
              </div>
              <div className="profile-form-grid">
                <div><label htmlFor="shift-start">Starts</label><input id="shift-start" onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} required type="datetime-local" value={form.startsAt} /></div>
                <div><label htmlFor="shift-end">Ends</label><input id="shift-end" onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} required type="datetime-local" value={form.endsAt} /></div>
              </div>
              <label htmlFor="shift-deadline">Acceptance deadline</label>
              <input id="shift-deadline" onChange={(event) => setForm((current) => ({ ...current, acceptanceDeadline: event.target.value }))} type="datetime-local" value={form.acceptanceDeadline} />
              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={() => setDialogOpen(false)} type="button">Cancel</button><button className="primary-button" disabled={saving} type="submit"><UserRoundCheck size={17} />{saving ? "Assigning..." : "Assign shift"}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function ShiftEmpty({ title }: { title: string }) {
  return <div className="shift-empty"><CalendarClock size={24} /><p>{title}</p></div>;
}

function toDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }
  return new Date(String(value));
}

function formatDate(value: unknown, timeZone?: string) {
  return timeZone
    ? formatInTimeZone(value, timeZone, { month: "short", day: "numeric" })
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(toDate(value));
}

function formatTimeRange(start: unknown, end: unknown, timeZone?: string) {
  const options = { hour: "numeric", minute: "2-digit" } as const;
  const startText = timeZone ? formatInTimeZone(start, timeZone, options) : new Intl.DateTimeFormat(undefined, options).format(toDate(start));
  const endText = timeZone ? formatInTimeZone(end, timeZone, options) : new Intl.DateTimeFormat(undefined, options).format(toDate(end));
  return `${startText} - ${endText}`;
}
