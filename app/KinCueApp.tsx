"use client";

import {
  AlarmClock,
  Bell,
  BellRing,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileText,
  Flame,
  HeartHandshake,
  Home,
  Info,
  Lightbulb,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  Phone,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Vault,
  Wifi,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { HandoverExtraction } from "../src/ai/schemas";

type Tab = "today" | "care" | "home" | "handover" | "vault";
type CueStatus = "upcoming" | "completed" | "snoozed" | "blocked";

type Cue = {
  id: string;
  time: string;
  title: string;
  detail: string;
  importance: "routine" | "important" | "critical";
  icon: LucideIcon;
  status: CueStatus;
};

const navItems: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "today", label: "Today", icon: CalendarDays },
  { id: "care", label: "Care", icon: HeartHandshake },
  { id: "home", label: "Home", icon: Home },
  { id: "handover", label: "Handover", icon: MessageSquareText },
  { id: "vault", label: "Vault", icon: Vault },
];

const seedCues: Cue[] = [
  {
    id: "breakfast",
    time: "8:00 AM",
    title: "Breakfast and morning water",
    detail: "Grandma · Kitchen · Routine from Priya",
    importance: "routine",
    icon: HeartHandshake,
    status: "completed",
  },
  {
    id: "medicine",
    time: "9:00 AM",
    title: "Morning medication",
    detail: "Grandma · Blue medicine box · Family verified",
    importance: "critical",
    icon: Pill,
    status: "upcoming",
  },
  {
    id: "physio",
    time: "11:30 AM",
    title: "Physiotherapy exercises",
    detail: "15 minutes · Guide available in Care",
    importance: "important",
    icon: HeartHandshake,
    status: "upcoming",
  },
  {
    id: "clinic",
    time: "2:00 PM",
    title: "Call clinic about Friday appointment",
    detail: "Dr. Sharma's office · Number in contacts",
    importance: "important",
    icon: Phone,
    status: "upcoming",
  },
  {
    id: "electricity",
    time: "6:00 PM",
    title: "Electricity bill reminder",
    detail: "Due tomorrow · Account details in Home Playbook",
    importance: "routine",
    icon: Lightbulb,
    status: "upcoming",
  },
];

const playbook = [
  {
    title: "LPG cylinder",
    category: "Utilities",
    summary: "Ordering steps, customer reference, and distributor contact.",
    icon: Flame,
  },
  {
    title: "Power and inverter",
    category: "Home safety",
    summary: "Main switches, inverter reset, and electrician details.",
    icon: Lightbulb,
  },
  {
    title: "Wi-Fi and router",
    category: "Connectivity",
    summary: "Router location, restart steps, and provider support.",
    icon: Wifi,
  },
  {
    title: "Regular home services",
    category: "Contacts",
    summary: "Plumber, electrician, pharmacy, and grocery delivery.",
    icon: Wrench,
  },
  {
    title: "Important documents",
    category: "Locations",
    summary: "Where originals are kept and who can access them.",
    icon: FileText,
  },
  {
    title: "Emergency plan",
    category: "Safety",
    summary: "Trusted contacts, home address, exits, and India 112.",
    icon: ShieldCheck,
  },
];

const documents = [
  ["Grandma discharge instructions.pdf", "Care", "Priya", "16 Jul 2026"],
  ["Current prescription.jpg", "Care", "Priya", "16 Jul 2026"],
  ["Electricity account details.pdf", "Home", "Rajesh", "11 Jul 2026"],
  ["LPG customer card.jpg", "Home", "Meera", "09 Jul 2026"],
];

const sampleTranscript =
  "Grandma ate late today, so the evening medicine was given at 9 PM after dinner. Her physiotherapy appointment has moved to Friday at 11 AM. The new prescription is still inside my blue bag in the bedroom. Please call the clinic tomorrow morning to confirm it.";

export function KinCueApp() {
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [cues, setCues] = useState(seedCues);
  const [transcript, setTranscript] = useState(sampleTranscript);
  const [extraction, setExtraction] = useState<HandoverExtraction | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const completedCount = useMemo(
    () => cues.filter((cue) => cue.status === "completed").length,
    [cues],
  );

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  function updateCue(id: string, status: CueStatus) {
    setCues((current) =>
      current.map((cue) => (cue.id === id ? { ...cue, status } : cue)),
    );
    notify(
      status === "completed"
        ? "Cue completed and shared with the family."
        : status === "snoozed"
          ? "Cue snoozed for 10 minutes."
          : "Cue marked as blocked. The backup caregiver can now help.",
    );
  }

  async function enableAlarms() {
    if (!("Notification" in window)) {
      notify("This browser does not support notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    notify(
      permission === "granted"
        ? "KinCue alarms are enabled on this device."
        : "Notifications remain disabled. Cues will still appear in the app.",
    );
  }

  async function structureHandover() {
    setExtracting(true);
    setExtraction(null);
    try {
      const response = await fetch("/api/handovers/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setExtraction(body.extraction);
      notify(
        body.mode === "gpt-5.6"
          ? "GPT-5.6 structured the handover for review."
          : "Local demo extraction complete. Add an API key for GPT-5.6.",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not structure handover.");
    } finally {
      setExtracting(false);
    }
  }

  const heading = navItems.find((item) => item.id === activeTab)?.label ?? "Today";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><BellRing size={19} /></span>
          <span>KinCue</span>
        </div>
        <button className="space-switcher" type="button" title="Switch Family Space">
          <Users size={18} />
          <span><strong>Sharma Family</strong><small>5 people · India</small></span>
          <ChevronDown size={15} />
        </button>
        <nav className="side-nav" aria-label="Primary navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-button ${activeTab === id ? "active" : ""}`}
              key={id}
              onClick={() => setActiveTab(id)}
              type="button"
              title={label}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-footer">
          <span className="avatar">AS</span>
          <div><strong>Aarav Sharma</strong><small>Helper · Son</small></div>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div>
            <button className="icon-button mobile-only" type="button" title="Open menu"><Menu size={19} /></button>
            <h1 className="desktop-only">{heading}</h1>
          </div>
          <div className="top-actions">
            <button className="text-button desktop-only" onClick={enableAlarms} type="button"><Bell size={16} /> Enable alarms</button>
            <button className="icon-button" type="button" title="Search KinCue"><Search size={18} /></button>
            <button className="icon-button" type="button" title="Emergency information"><CircleAlert size={18} /></button>
          </div>
        </header>

        {activeTab === "today" && (
          <section className="content">
            <div className="page-heading">
              <div><p className="eyebrow">Friday, 17 July</p><h2>Good evening, Aarav</h2><p>You are covering Grandma’s care today. Here is what needs attention next.</p></div>
              <button className="primary-button" onClick={() => setActiveTab("handover")} type="button"><MessageSquareText size={17} /> View briefing</button>
            </div>
            <div className="shift-band">
              <div><div className="shift-title"><HeartHandshake size={18} /> Active Care Shift</div><p>Grandma’s weekend care · Today 6:00 PM to Sunday 8:00 PM</p></div>
              <div className="shift-people"><span><strong>Primary</strong><br />Aarav</span><span><strong>Backup</strong><br />Ananya</span></div>
            </div>
            <div className="status-strip" aria-label="Today summary">
              <div className="metric"><strong>{cues.length}</strong><span>Today’s cues</span></div>
              <div className="metric"><strong>{completedCount}</strong><span>Completed</span></div>
              <div className="metric"><strong>{cues.length - completedCount}</strong><span>Still ahead</span></div>
              <div className="metric"><strong>0</strong><span>Need help</span></div>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>Today’s timeline</h3><span>Asia/Kolkata</span></div>
              <ul className="cue-list">
                {cues.map((cue) => {
                  const Icon = cue.icon;
                  return (
                    <li className={`cue-row is-${cue.status}`} key={cue.id}>
                      <span className="cue-time">{cue.time}</span>
                      <span className={`cue-icon ${cue.importance}`}><Icon size={17} /></span>
                      <span className="cue-copy"><strong>{cue.title}</strong><span>{cue.detail}</span></span>
                      <span className="cue-actions">
                        {cue.status === "upcoming" ? (
                          <>
                            <button className="icon-button" onClick={() => updateCue(cue.id, "completed")} title="Mark complete" type="button"><Check size={17} /></button>
                            <button className="icon-button" onClick={() => updateCue(cue.id, "snoozed")} title="Snooze cue" type="button"><Clock3 size={17} /></button>
                            <button className="icon-button" onClick={() => updateCue(cue.id, "blocked")} title="Ask for help" type="button"><CircleAlert size={17} /></button>
                          </>
                        ) : <span className={`status-pill ${cue.status}`}>{cue.status}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {activeTab === "care" && (
          <section className="content">
            <div className="page-heading"><div><p className="eyebrow">Care profile</p><h2>Grandma · Savitri Sharma</h2><p>Verified routines, instructions, contacts, and upcoming care.</p></div><button className="primary-button" type="button"><Plus size={17} /> Add instruction</button></div>
            <div className="split-layout">
              <div className="panel">
                <div className="profile-header"><span className="profile-avatar">SS</span><div><h3>Savitri Sharma</h3><p>Grandmother · Profile maintained by Priya</p></div></div>
                <div className="detail-section"><h4>Verified care information</h4><div className="detail-grid">
                  <div className="detail-item"><span>Morning medication</span><strong>9:00 AM · After breakfast</strong></div>
                  <div className="detail-item"><span>Evening medication</span><strong>8:00 PM · After dinner</strong></div>
                  <div className="detail-item"><span>Medication location</span><strong>Blue box · Bedroom cabinet</strong></div>
                  <div className="detail-item"><span>Prescription</span><strong>Top drawer · Current copy in Vault</strong></div>
                </div></div>
                <div className="detail-section"><h4>Daily routine</h4><ul className="plain-list">
                  <li><AlarmClock size={17} /><div><strong>8:00 AM · Breakfast</strong><span>Warm breakfast and one glass of water.</span></div></li>
                  <li><HeartHandshake size={17} /><div><strong>11:30 AM · Guided movement</strong><span>Use the 15-minute physiotherapy guide.</span></div></li>
                  <li><BookOpen size={17} /><div><strong>4:30 PM · Quiet time</strong><span>Tea, newspaper, and hearing aid check.</span></div></li>
                </ul></div>
              </div>
              <aside className="panel">
                <div className="panel-header"><h3>Trusted contacts</h3><button className="icon-button" type="button" title="More contact options"><MoreHorizontal size={17} /></button></div>
                <ul className="plain-list">
                  <li><UserRound size={17} /><div><strong>Priya Sharma</strong><span>Primary caregiver · Call first</span></div></li>
                  <li><Phone size={17} /><div><strong>Dr. Sharma’s office</strong><span>Clinic · Mon–Sat, 9 AM–6 PM</span></div></li>
                  <li><UserRound size={17} /><div><strong>Ananya Sharma</strong><span>Backup caregiver this weekend</span></div></li>
                </ul>
              </aside>
            </div>
          </section>
        )}

        {activeTab === "home" && (
          <section className="content">
            <div className="page-heading"><div><p className="eyebrow">Home Playbook</p><h2>How the Sharma home runs</h2><p>Practical household knowledge that another trusted person can follow.</p></div><button className="primary-button" type="button"><Plus size={17} /> Add entry</button></div>
            <div className="playbook-grid">
              {playbook.map(({ title, category, summary, icon: Icon }) => (
                <article className="playbook-entry" key={title}>
                  <div className="entry-top"><span className="entry-icon"><Icon size={17} /></span><span className="category-label">{category}</span></div>
                  <div><h3>{title}</h3><p>{summary}</p></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "handover" && (
          <section className="content">
            <div className="page-heading"><div><p className="eyebrow">AI-assisted handover</p><h2>Turn an update into a clear briefing</h2><p>KinCue extracts proposed facts and keeps every change pending until a family member confirms it.</p></div></div>
            <div className="handover-grid">
              <div className="panel">
                <div className="panel-header"><h3>Outgoing caregiver update</h3><span>Draft</span></div>
                <div className="composer">
                  <label htmlFor="handover-text">Speak or type what changed</label>
                  <textarea id="handover-text" value={transcript} onChange={(event) => setTranscript(event.target.value)} />
                  <div className="composer-actions">
                    <button className="secondary-button" type="button" onClick={() => notify("Voice capture is the next integration step.")}><Mic size={17} /> Record</button>
                    <button className="primary-button" type="button" disabled={extracting} onClick={structureHandover}><Sparkles size={17} /> {extracting ? "Structuring…" : "Structure handover"}</button>
                  </div>
                  <p className="safe-note"><Info size={14} /> AI suggestions remain drafts. Medication details are preserved exactly as provided and require confirmation.</p>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header"><h3>Proposed briefing</h3><span>{extraction ? `${extraction.items.length} items` : "Waiting"}</span></div>
                {!extraction ? (
                  <div className="extraction-empty"><div><Sparkles size={28} /><h3>Ready to structure</h3><p>KinCue will separate schedules, care instructions, locations, tasks, and unresolved questions.</p></div></div>
                ) : (
                  <div>
                    <div className="extraction-summary">{extraction.summary}</div>
                    {extraction.items.map((item, index) => (
                      <div className="extracted-item" key={`${item.type}-${index}`}>
                        <div className="extracted-top"><strong>{item.title}</strong><span className="source-chip">Source preserved</span></div>
                        <div className="field-grid">
                          <div><span>Person</span><br />{item.person ?? "Not stated"}</div>
                          <div><span>Time</span><br />{item.scheduledTime ?? "Not stated"}</div>
                          <div><span>Condition</span><br />{item.condition ?? "None stated"}</div>
                          <div><span>Confidence</span><br />{item.confidence}</div>
                        </div>
                        {item.warnings.map((warning) => <div className="warning-line" key={warning}><CircleAlert size={14} />{warning}</div>)}
                      </div>
                    ))}
                    <div className="confirm-row"><button className="secondary-button" type="button">Edit</button><button className="primary-button" type="button" onClick={() => notify("Proposals confirmed for the demo family.")}><CheckCircle2 size={17} /> Confirm proposals</button></div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "vault" && (
          <section className="content">
            <div className="page-heading"><div><p className="eyebrow">Private family files</p><h2>Vault</h2><p>Source documents, photographs, and household records with controlled family access.</p></div><button className="primary-button" type="button"><Plus size={17} /> Upload file</button></div>
            <div className="panel">
              <div className="panel-header"><h3>Family documents</h3><span className="inline-label"><LockKeyhole size={13} /> Private</span></div>
              <table className="vault-table"><thead><tr><th>Document</th><th>Area</th><th>Added by</th><th>Updated</th></tr></thead><tbody>
                {documents.map(([name, area, owner, updated]) => <tr key={name}><td><span className="document-name"><FileText size={16} />{name}</span></td><td>{area}</td><td>{owner}</td><td>{updated}</td></tr>)}
              </tbody></table>
            </div>
          </section>
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ id, label, icon: Icon }) => <button className={activeTab === id ? "active" : ""} key={id} onClick={() => setActiveTab(id)} type="button"><Icon size={19} /><span>{label}</span></button>)}
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
