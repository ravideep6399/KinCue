"use client";

import { Activity, X } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeToActivity } from "../src/firebase/activity";
import type { ActivityEvent } from "../src/firebase/models";
import { useFamilySpace } from "./FamilySpace";

export function FamilyActivityButton() {
  const { activeSpace } = useFamilySpace();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !activeSpace) return;
    return subscribeToActivity(
      activeSpace.familySpaceId,
      (nextEvents) => {
        setEvents(nextEvents);
        setLoading(false);
        setError(null);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoading(false);
      },
    );
  }, [activeSpace, open]);

  function openDialog() {
    setLoading(true);
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <button className="icon-button" onClick={openDialog} title="Family activity" type="button"><Activity size={18} /></button>
      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)} role="presentation">
          <section aria-labelledby="activity-dialog-title" aria-modal="true" className="member-dialog activity-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <header className="dialog-header"><div><p className="eyebrow">{activeSpace?.name}</p><h2 id="activity-dialog-title">Family activity</h2></div><button className="icon-button" onClick={() => setOpen(false)} title="Close" type="button"><X size={18} /></button></header>
            <div className="activity-dialog-body">
              {loading ? <p className="muted-copy">Loading activity...</p> : events.length === 0 ? <div className="dialog-empty"><Activity size={25} /><h3>No activity recorded</h3></div> : <ul className="activity-list">{events.map((event) => <li key={event.id}><span className="activity-dot" /><div><strong>{event.summary}</strong><span>{event.actorDisplayName} | {formatDate(event.createdAt)}</span></div></li>)}</ul>}
              {error && <p className="auth-error" role="alert">{error}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function formatDate(value: unknown) {
  const date = value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate() as Date : new Date(String(value));
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date) : "Just now";
}
