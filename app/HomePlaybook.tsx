"use client";

import { Bell, BookOpen, MapPin, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  createPlaybookEntry,
  subscribeToPlaybookEntries,
  updatePlaybookEntry,
  type PlaybookEntryInput,
} from "../src/firebase/playbook";
import type { FamilyMember, PlaybookEntry } from "../src/firebase/models";
import { subscribeToFamilyMembers } from "../src/firebase/family-members";
import { useKinCueAuth } from "./FirebaseAuth";
import { useFamilySpace } from "./FamilySpace";
import { recordActivity } from "../src/firebase/activity";
import { formatInTimeZone, toZonedDateTimeInput } from "../src/time/timezone";

const emptyEntry: PlaybookEntryInput = {
  title: "",
  category: "general",
  details: "",
  locationLabel: "",
  reminderAt: "",
  assignedUserId: "",
};

export function HomePlaybook({ notify }: { notify: (message: string) => void }) {
  const { identity } = useKinCueAuth();
  const { activeSpace } = useFamilySpace();
  const [entries, setEntries] = useState<PlaybookEntry[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loadedSpaceId, setLoadedSpaceId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlaybookEntry | null>(null);
  const [form, setForm] = useState<PlaybookEntryInput>(emptyEntry);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canContribute = activeSpace?.role !== "viewer";
  const loading = loadedSpaceId !== activeSpace?.familySpaceId;

  useEffect(() => {
    if (!activeSpace) return;
    const familySpaceId = activeSpace.familySpaceId;
    const unsubscribeEntries = subscribeToPlaybookEntries(
      familySpaceId,
      (nextEntries) => {
        setEntries(nextEntries);
        setLoadedSpaceId(familySpaceId);
        setError(null);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoadedSpaceId(familySpaceId);
      },
    );
    const unsubscribeMembers = subscribeToFamilyMembers(familySpaceId, setMembers, (memberError) => setError(memberError.message));
    return () => {
      unsubscribeEntries();
      unsubscribeMembers();
    };
  }, [activeSpace]);

  function openCreate() {
    setEditing(null);
    setForm(emptyEntry);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(entry: PlaybookEntry) {
    setEditing(entry);
    setForm({
      title: entry.title,
      category: entry.category,
      details: entry.details,
      locationLabel: entry.locationLabel ?? "",
      reminderAt: activeSpace ? toZonedDateTimeInput(entry.reminderAt, activeSpace.timezone) : "",
      assignedUserId: entry.assignedUserId ?? "",
    });
    setError(null);
    setDialogOpen(true);
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSpace || !identity || !form.title.trim() || !form.details.trim()) return;
    if (form.reminderAt && !form.assignedUserId) {
      setError("Choose a responsible member for the reminder.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updatePlaybookEntry(activeSpace.familySpaceId, editing.id, activeSpace.timezone, form);
        void recordActivity(activeSpace.familySpaceId, identity, "playbook_updated", `Updated Playbook entry: ${form.title.trim()}`);
        notify("Playbook entry updated.");
      } else {
        await createPlaybookEntry(activeSpace.familySpaceId, identity.uid, activeSpace.timezone, form);
        void recordActivity(activeSpace.familySpaceId, identity, "playbook_created", `Created Playbook entry: ${form.title.trim()}`);
        notify("Playbook entry created.");
      }
      setDialogOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The Playbook entry could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content">
      <div className="page-heading">
        <div><p className="eyebrow">Home Playbook</p><h2>Household knowledge</h2><p>Shared instructions, locations, contacts, and reminders.</p></div>
        {canContribute && <button className="primary-button" onClick={openCreate} type="button"><Plus size={17} /> Add entry</button>}
      </div>
      <div className="panel">
        <div className="panel-header"><h3>Playbook entries</h3><span>{loading ? "Loading" : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}</span></div>
        {loading ? (
          <PlaybookEmpty title="Loading household knowledge..." />
        ) : entries.length === 0 ? (
          <PlaybookEmpty title="No Playbook entries" />
        ) : (
          <ul className="playbook-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <span className="entry-icon"><BookOpen size={17} /></span>
                <div className="playbook-copy">
                  <div><span className="category-label">{entry.category}</span><strong>{entry.title}</strong></div>
                  <p>{entry.details}</p>
                  <div className="playbook-meta">
                    {entry.locationLabel && <span><MapPin size={13} />{entry.locationLabel}</span>}
                    {entry.reminderAt != null && <span><Bell size={13} />{formatDate(entry.reminderAt, activeSpace?.timezone)} | {memberName(members, entry.assignedUserId)}</span>}
                  </div>
                </div>
                {canContribute && <button className="icon-button" onClick={() => openEdit(entry)} title={`Edit ${entry.title}`} type="button"><Pencil size={16} /></button>}
              </li>
            ))}
          </ul>
        )}
        {error && !dialogOpen && !loading && <p className="panel-error" role="alert">{error}</p>}
      </div>

      {dialogOpen && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setDialogOpen(false)} role="presentation">
          <section aria-labelledby="playbook-dialog-title" aria-modal="true" className="member-dialog playbook-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <header className="dialog-header"><div><p className="eyebrow">Home Playbook</p><h2 id="playbook-dialog-title">{editing ? "Edit entry" : "Add entry"}</h2></div><button className="icon-button" disabled={saving} onClick={() => setDialogOpen(false)} title="Close" type="button"><X size={18} /></button></header>
            <form className="profile-form" onSubmit={saveEntry}>
              <label htmlFor="playbook-title">Title</label><input id="playbook-title" maxLength={100} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} />
              <label htmlFor="playbook-category">Category</label><select id="playbook-category" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as PlaybookEntryInput["category"] }))} value={form.category}><option value="general">General</option><option value="utilities">Utilities</option><option value="appliances">Appliances</option><option value="documents">Documents</option><option value="contacts">Contacts</option><option value="emergency">Emergency</option></select>
              <label htmlFor="playbook-details">Instructions or details</label><textarea id="playbook-details" maxLength={3000} onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} required rows={6} value={form.details} />
              <label htmlFor="playbook-location">Location</label><input id="playbook-location" maxLength={120} onChange={(event) => setForm((current) => ({ ...current, locationLabel: event.target.value }))} value={form.locationLabel} />
              <div className="profile-form-grid">
                <div><label htmlFor="playbook-reminder">One-time reminder</label><input id="playbook-reminder" onChange={(event) => setForm((current) => ({ ...current, reminderAt: event.target.value }))} type="datetime-local" value={form.reminderAt} /></div>
                <div><label htmlFor="playbook-assignee">Responsible member</label><select id="playbook-assignee" onChange={(event) => setForm((current) => ({ ...current, assignedUserId: event.target.value }))} value={form.assignedUserId}><option value="">No assignee</option>{members.filter((member) => member.role !== "viewer").map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</select></div>
              </div>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={() => setDialogOpen(false)} type="button">Cancel</button><button className="primary-button" disabled={saving || !form.title.trim() || !form.details.trim()} type="submit">{saving ? "Saving..." : "Save entry"}</button></div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function PlaybookEmpty({ title }: { title: string }) {
  return <div className="product-empty"><BookOpen size={28} /><h3>{title}</h3></div>;
}

function asDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate() as Date;
  return value ? new Date(String(value)) : null;
}

function formatDate(value: unknown, timeZone?: string) {
  if (timeZone) return formatInTimeZone(value, timeZone, { dateStyle: "medium", timeStyle: "short" });
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date) : "";
}

function memberName(members: FamilyMember[], userId: string | null) {
  return members.find((member) => member.userId === userId)?.displayName ?? "Unassigned";
}
