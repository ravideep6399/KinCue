"use client";

import { BellRing, CalendarDays, Check, CircleAlert, Clock3 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  blockCue,
  completeCue,
  snoozeCue,
  subscribeToCueOccurrences,
} from "../src/firebase/cue-occurrences";
import type { CueOccurrence } from "../src/firebase/models";
import { useKinCueAuth } from "./FirebaseAuth";
import { useFamilySpace } from "./FamilySpace";
import { recordActivity } from "../src/firebase/activity";
import { dateKeyInZone, formatInTimeZone } from "../src/time/timezone";

export function TodayDashboard({ notify }: { notify: (message: string) => void }) {
  const { identity, getAccessToken } = useKinCueAuth();
  const { activeSpace } = useFamilySpace();
  const [occurrences, setOccurrences] = useState<CueOccurrence[]>([]);
  const [loadedSpaceId, setLoadedSpaceId] = useState<string | null>(null);
  const [todayContext, setTodayContext] = useState<{ spaceId: string; key: string } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const loading = loadedSpaceId !== activeSpace?.familySpaceId || todayContext?.spaceId !== activeSpace?.familySpaceId;
  const canCoordinate = activeSpace?.role === "owner" || activeSpace?.role === "primary_caregiver";

  const syncCues = useCallback(async () => {
    if (!activeSpace) return;
    const token = await getAccessToken();
    const response = await fetch(`/api/family-spaces/${activeSpace.familySpaceId}/cues/sync`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return { ...body, spaceId: activeSpace.familySpaceId };
  }, [activeSpace, getAccessToken]);

  useEffect(() => {
    if (!activeSpace) return;
    const familySpaceId = activeSpace.familySpaceId;
    const unsubscribe = subscribeToCueOccurrences(
      familySpaceId,
      (nextOccurrences) => {
        setOccurrences(nextOccurrences);
        setLoadedSpaceId(familySpaceId);
        setError(null);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoadedSpaceId(familySpaceId);
      },
    );
    void syncCues()
      .then((result) => {
        setClock(Date.now());
        if (typeof result.todayKey === "string") setTodayContext({ spaceId: result.spaceId, key: result.todayKey });
      })
      .catch((syncError) => {
        setError(syncError instanceof Error ? syncError.message : "Scheduled cues could not be synchronized.");
      });
    const interval = window.setInterval(() => {
      setClock(Date.now());
      void syncCues().then((result) => {
        if (typeof result.todayKey === "string") setTodayContext({ spaceId: result.spaceId, key: result.todayKey });
      }).catch(() => undefined);
    }, 60_000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [activeSpace, syncCues]);

  useEffect(() => {
    if (
      !identity ||
      loadedSpaceId !== activeSpace?.familySpaceId ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) return;
    for (const occurrence of occurrences) {
      const notificationBase = `kincue-notified:${occurrence.id}`;
      if (occurrence.status === "snoozed") {
        window.localStorage.removeItem(`${notificationBase}:due`);
        window.localStorage.removeItem(`${notificationBase}:overdue`);
        continue;
      }
      const assignedAlarm = occurrence.assignedUserId === identity.uid && ["due", "overdue"].includes(occurrence.status);
      const coordinatorAlarm = canCoordinate && occurrence.status === "blocked" && timestampMillis(occurrence.scheduledAt) <= clock;
      if (!assignedAlarm && !coordinatorAlarm) continue;
      const notificationKey = `kincue-notified:${occurrence.id}:${occurrence.status}`;
      if (window.localStorage.getItem(notificationKey)) continue;
      new Notification(coordinatorAlarm ? `Coverage needed: ${occurrence.title}` : occurrence.title, {
        body: occurrence.blockedReason || occurrence.instructions,
        tag: occurrence.id,
      });
      window.localStorage.setItem(notificationKey, "1");
    }
  }, [activeSpace?.familySpaceId, canCoordinate, clock, identity, loadedSpaceId, occurrences]);

  const assignedAlarmCues = loadedSpaceId === activeSpace?.familySpaceId
    ? occurrences.filter(
        (occurrence) =>
          occurrence.assignedUserId === identity?.uid &&
          ["due", "overdue"].includes(occurrence.status),
      )
    : [];
  const uncoveredAlarmCues = canCoordinate && loadedSpaceId === activeSpace?.familySpaceId
    ? occurrences.filter(
        (occurrence) =>
          occurrence.status === "blocked" &&
          timestampMillis(occurrence.scheduledAt) <= clock,
      )
    : [];
  const todayOccurrences = activeSpace && todayContext?.spaceId === activeSpace.familySpaceId
    ? occurrences.filter((occurrence) =>
        dateKeyInZone(occurrence.scheduledAt, activeSpace.timezone) === todayContext.key || occurrence.status === "overdue",
      )
    : [];
  const completedCount = todayOccurrences.filter((occurrence) => occurrence.status === "completed").length;
  const aheadCount = todayOccurrences.filter((occurrence) => ["upcoming", "snoozed"].includes(occurrence.status)).length;
  const helpCount = todayOccurrences.filter((occurrence) => occurrence.status === "blocked").length;

  async function perform(action: () => Promise<void>, message: string, type: string, summary: string) {
    try {
      await action();
      if (activeSpace && identity) void recordActivity(activeSpace.familySpaceId, identity, type, summary);
      notify(message);
      const result = await syncCues();
      if (typeof result.todayKey === "string") setTodayContext({ spaceId: result.spaceId, key: result.todayKey });
    } catch (actionError) {
      notify(actionError instanceof Error ? actionError.message : "The cue could not be updated.");
    }
  }

  return (
    <section className="content">
      <div className="page-heading">
        <div><p className="eyebrow">Today</p><h2>Care timeline</h2><p>Your Family Space schedule, synchronized across caregivers.</p></div>
      </div>

      {assignedAlarmCues.length > 0 && (
        <div className="alarm-band" role="alert">
          <span className="alarm-icon"><BellRing size={21} /></span>
          <div><strong>{assignedAlarmCues[0].title}</strong><p>{assignedAlarmCues.length === 1 ? "A care cue needs your attention now." : `${assignedAlarmCues.length} care cues need your attention now.`}</p></div>
        </div>
      )}

      {uncoveredAlarmCues.length > 0 && (
        <div className="alarm-band" role="alert">
          <span className="alarm-icon"><CircleAlert size={21} /></span>
          <div><strong>Care coverage needed</strong><p>{uncoveredAlarmCues.length === 1 ? `${uncoveredAlarmCues[0].title} is due without an accepted caregiver.` : `${uncoveredAlarmCues.length} due care cues need an accepted caregiver.`}</p></div>
        </div>
      )}

      <div className="status-strip" aria-label="Today summary">
        <div className="metric"><strong>{todayOccurrences.length}</strong><span>Scheduled cues</span></div>
        <div className="metric"><strong>{completedCount}</strong><span>Completed</span></div>
        <div className="metric"><strong>{aheadCount}</strong><span>Still ahead</span></div>
        <div className="metric"><strong>{helpCount}</strong><span>Need help</span></div>
      </div>

      <div className="panel">
        <div className="panel-header"><h3>Today&apos;s timeline</h3><span>{activeSpace?.timezone}</span></div>
        {loading ? (
          <CueEmpty title="Loading scheduled cues..." body="" />
        ) : todayOccurrences.length === 0 ? (
          <CueEmpty title="No cues scheduled" body="Scheduled routines will appear after a care shift covers their time." />
        ) : (
          <ul className="cue-list">
            {todayOccurrences.map((occurrence) => {
              const canAct = canCoordinate || occurrence.assignedUserId === identity?.uid;
              return (
                <li className={`cue-row ${occurrence.status === "completed" ? "is-completed" : ""}`} key={occurrence.id}>
                  <span className="cue-time">{formatCueTime(occurrence.scheduledAt, activeSpace?.timezone)}</span>
                  <span className={`cue-icon ${occurrence.importance}`}>
                    {occurrence.status === "blocked" ? <CircleAlert size={17} /> : <Clock3 size={17} />}
                  </span>
                  <span className="cue-copy"><strong>{occurrence.title}</strong><span>{occurrence.blockedReason || occurrence.instructions}</span></span>
                  <div className="cue-actions">
                    <span className={`status-pill ${occurrence.status}`}>{occurrence.status}</span>
                    {canAct && !["completed", "skipped"].includes(occurrence.status) && (
                      <>
                        <button className="icon-button" onClick={() => void perform(() => completeCue(activeSpace!.familySpaceId, occurrence.id), "Cue completed.", "cue_completed", `Completed cue: ${occurrence.title}`)} title="Complete cue" type="button"><Check size={16} /></button>
                        {occurrence.assignedUserId && <button className="icon-button" onClick={() => void perform(() => snoozeCue(activeSpace!.familySpaceId, occurrence.id, 10), "Cue snoozed for 10 minutes.", "cue_snoozed", `Snoozed cue: ${occurrence.title}`)} title="Snooze 10 minutes" type="button"><Clock3 size={16} /></button>}
                        <button className="icon-button" onClick={() => void perform(() => blockCue(activeSpace!.familySpaceId, occurrence.id, "Caregiver requested help."), "Help requested for this cue.", "cue_blocked", `Requested help for cue: ${occurrence.title}`)} title="Request help" type="button"><CircleAlert size={16} /></button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error && !loading && <p className="panel-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}

function CueEmpty({ title, body }: { title: string; body: string }) {
  return <div className="product-empty"><CalendarDays size={28} /><h3>{title}</h3>{body && <p>{body}</p>}</div>;
}

function formatCueTime(value: unknown, timeZone?: string) {
  if (timeZone) return formatInTimeZone(value, timeZone, { hour: "numeric", minute: "2-digit" });
  const date = value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
    ? value.toDate() as Date
    : new Date(String(value));
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function timestampMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis() as number;
  }
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).getTime();
  }
  return new Date(String(value)).getTime();
}
