"use client";

import { BookOpen, Clock3, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  createCareRoutine,
  subscribeToCareRoutines,
  updateCareRoutine,
  type CareRoutineInput,
} from "../src/firebase/care-routines";
import type { CareProfile, CareRoutine } from "../src/firebase/models";
import { useKinCueAuth } from "./FirebaseAuth";
import { useFamilySpace } from "./FamilySpace";
import { recordActivity } from "../src/firebase/activity";

const weekdays = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const reminderHours = Array.from({ length: 12 }, (_, index) => index + 1);
const reminderMinutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

const emptyRoutine: CareRoutineInput = {
  title: "",
  instructions: "",
  category: "general",
  importance: "routine",
  timeOfDay: "",
  daysOfWeek: [],
};

export function CareRoutinesButton({
  profile,
  canCoordinate,
  notify,
}: {
  profile: CareProfile;
  canCoordinate: boolean;
  notify: (message: string) => void;
}) {
  const { identity } = useKinCueAuth();
  const { activeSpace } = useFamilySpace();
  const [open, setOpen] = useState(false);
  const [routines, setRoutines] = useState<CareRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CareRoutine | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CareRoutineInput>(emptyRoutine);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !activeSpace) return;
    return subscribeToCareRoutines(
      activeSpace.familySpaceId,
      profile.id,
      (nextRoutines) => {
        setRoutines(nextRoutines);
        setLoading(false);
        setError(null);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoading(false);
      },
    );
  }, [activeSpace, open, profile.id]);

  function openDialog() {
    setLoading(true);
    setError(null);
    setOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setOpen(false);
    setShowForm(false);
    setEditing(null);
  }

  function beginCreate() {
    setEditing(null);
    setForm(emptyRoutine);
    setError(null);
    setShowForm(true);
  }

  function beginEdit(routine: CareRoutine) {
    setEditing(routine);
    setForm({
      title: routine.title,
      instructions: routine.instructions,
      category: routine.category,
      importance: routine.importance,
      timeOfDay: routine.timeOfDay ?? "",
      daysOfWeek: routine.daysOfWeek,
    });
    setError(null);
    setShowForm(true);
  }

  function toggleDay(day: number) {
    setForm((current) => ({
      ...current,
      daysOfWeek: current.daysOfWeek.includes(day)
        ? current.daysOfWeek.filter((value) => value !== day)
        : [...current.daysOfWeek, day],
    }));
  }

  function changeReminderTime(part: "hour" | "minute" | "period", value: string) {
    setForm((current) => {
      if (part === "hour" && !value) {
        return { ...current, timeOfDay: "", daysOfWeek: [] };
      }
      const existing = reminderTimeParts(current.timeOfDay);
      const hour = part === "hour" ? Number(value) : existing.hour;
      const minute = part === "minute" ? value : existing.minute;
      const period = part === "period" ? value : existing.period;
      return {
        ...current,
        timeOfDay: toTwentyFourHourTime(hour, minute, period),
      };
    });
  }

  async function saveRoutine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSpace || !identity || !form.title.trim() || !form.instructions.trim()) return;
    if (form.timeOfDay && form.daysOfWeek.length === 0) {
      setError("Select at least one day for a scheduled routine.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateCareRoutine(activeSpace.familySpaceId, editing.id, form);
        void recordActivity(activeSpace.familySpaceId, identity, "care_routine_updated", `Updated routine: ${form.title.trim()}`);
        notify("Care routine updated.");
      } else {
        await createCareRoutine(activeSpace.familySpaceId, profile.id, identity.uid, form);
        void recordActivity(activeSpace.familySpaceId, identity, "care_routine_created", `Created routine: ${form.title.trim()}`);
        notify("Care routine created.");
      }
      setShowForm(false);
      setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The routine could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="icon-button" onClick={openDialog} title={`Routines for ${profile.preferredName || profile.fullName}`} type="button">
        <BookOpen size={16} />
      </button>
      {open && (
        <div className="modal-backdrop" onMouseDown={closeDialog} role="presentation">
          <section aria-labelledby="routine-dialog-title" aria-modal="true" className="member-dialog routine-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <header className="dialog-header">
              <div>
                <p className="eyebrow">Care routines</p>
                <h2 id="routine-dialog-title">{profile.preferredName || profile.fullName}</h2>
              </div>
              <button className="icon-button" disabled={saving} onClick={closeDialog} title="Close" type="button"><X size={18} /></button>
            </header>

            <div className="routine-dialog-body">
              {!showForm && (
                <>
                  <div className="routine-toolbar">
                    <span>{loading ? "Loading" : `${routines.length} ${routines.length === 1 ? "routine" : "routines"}`}</span>
                    {canCoordinate && <button className="primary-button" onClick={beginCreate} type="button"><Plus size={16} /> Add routine</button>}
                  </div>
                  {loading ? (
                    <p className="muted-copy">Loading routines...</p>
                  ) : routines.length === 0 ? (
                    <div className="dialog-empty"><BookOpen size={25} /><h3>No routines added</h3></div>
                  ) : (
                    <ul className="routine-list">
                      {routines.map((routine) => (
                        <li key={routine.id}>
                          <span className={`importance-marker ${routine.importance}`} />
                          <div className="routine-copy">
                            <strong>{routine.title}</strong>
                            <p>{routine.instructions}</p>
                            <div className="routine-meta">
                              <span>{routine.category.replaceAll("_", " ")}</span>
                              {routine.timeOfDay && <span><Clock3 size={13} />{formatReminderTime(routine.timeOfDay)} | {routine.daysOfWeek.map((day) => weekdays[day]?.label).join(", ")}</span>}
                            </div>
                          </div>
                          {canCoordinate && <button className="icon-button" onClick={() => beginEdit(routine)} title={`Edit ${routine.title}`} type="button"><Pencil size={15} /></button>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {showForm && (
                <form className="routine-form" onSubmit={saveRoutine}>
                  <div className="form-section-heading"><h3>{editing ? "Edit routine" : "New routine"}</h3></div>
                  <label htmlFor="routine-title">Title</label>
                  <input id="routine-title" maxLength={100} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} />
                  <div className="profile-form-grid">
                    <div>
                      <label htmlFor="routine-category">Category</label>
                      <select id="routine-category" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as CareRoutineInput["category"] }))} value={form.category}>
                        <option value="general">General</option><option value="medication">Medication</option><option value="meal">Meal</option><option value="mobility">Mobility</option><option value="appointment">Appointment</option><option value="personal_care">Personal care</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="routine-importance">Importance</label>
                      <select id="routine-importance" onChange={(event) => setForm((current) => ({ ...current, importance: event.target.value as CareRoutineInput["importance"] }))} value={form.importance}>
                        <option value="routine">Routine</option><option value="important">Important</option><option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <label htmlFor="routine-instructions">Exact instructions</label>
                  <textarea id="routine-instructions" maxLength={2000} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} required rows={5} value={form.instructions} />
                  <fieldset className="time-fieldset">
                    <legend>Reminder time</legend>
                    <div className="time-picker-grid">
                      <label htmlFor="routine-hour">Hour
                        <select id="routine-hour" onChange={(event) => changeReminderTime("hour", event.target.value)} value={form.timeOfDay ? String(reminderTimeParts(form.timeOfDay).hour) : ""}>
                          <option value="">None</option>
                          {reminderHours.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}</option>)}
                        </select>
                      </label>
                      <label htmlFor="routine-minute">Minute
                        <select disabled={!form.timeOfDay} id="routine-minute" onChange={(event) => changeReminderTime("minute", event.target.value)} value={reminderTimeParts(form.timeOfDay).minute}>
                          {reminderMinutes.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                        </select>
                      </label>
                      <label htmlFor="routine-period">AM / PM
                        <select disabled={!form.timeOfDay} id="routine-period" onChange={(event) => changeReminderTime("period", event.target.value)} value={reminderTimeParts(form.timeOfDay).period}>
                          <option value="AM">AM</option><option value="PM">PM</option>
                        </select>
                      </label>
                    </div>
                    <small>Uses the Family Space timezone: {activeSpace?.timezone}. An accepted care shift assigns the alert; uncovered due routines alert coordinators.</small>
                  </fieldset>
                  {form.timeOfDay && (
                    <fieldset className="weekday-fieldset">
                      <legend>Reminder days</legend>
                      <div className="weekday-options">
                        {weekdays.map((day) => (
                          <label key={day.value}><input checked={form.daysOfWeek.includes(day.value)} onChange={() => toggleDay(day.value)} type="checkbox" /> <span>{day.label}</span></label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                  {error && <p className="auth-error" role="alert">{error}</p>}
                  <div className="form-actions">
                    <button className="secondary-button" disabled={saving} onClick={() => setShowForm(false)} type="button">Cancel</button>
                    <button className="primary-button" disabled={saving || !form.title.trim() || !form.instructions.trim()} type="submit">{saving ? "Saving..." : "Save routine"}</button>
                  </div>
                </form>
              )}
              {error && !showForm && <p className="auth-error" role="alert">{error}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function reminderTimeParts(value: string) {
  if (!value) return { hour: 12, minute: "00", period: "AM" };
  const [hourText, minute = "00"] = value.split(":");
  const hour24 = Number(hourText);
  return {
    hour: hour24 % 12 || 12,
    minute,
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

function toTwentyFourHourTime(hour: number, minute: string, period: string) {
  const normalizedHour = period === "PM" ? (hour % 12) + 12 : hour % 12;
  return `${String(normalizedHour).padStart(2, "0")}:${minute}`;
}

function formatReminderTime(value: string) {
  const parts = reminderTimeParts(value);
  return `${parts.hour}:${parts.minute} ${parts.period}`;
}
