"use client";

import {
  Bell,
  BellRing,
  CalendarDays,
  ChevronDown,
  HeartHandshake,
  Home,
  LogOut,
  MessageSquareText,
  Users,
  Vault,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { CareProfiles } from "./CareProfiles";
import { FamilyMembersButton } from "./FamilyMembers";
import { useKinCueAuth } from "./FirebaseAuth";
import { useFamilySpace } from "./FamilySpace";
import { TodayDashboard } from "./TodayDashboard";
import { HomePlaybook } from "./HomePlaybook";
import { HandoverWorkspace } from "./HandoverWorkspace";
import { FamilyVault } from "./FamilyVault";
import { FamilyActivityButton } from "./FamilyActivity";

type Tab = "today" | "care" | "home" | "handover" | "vault";

const navItems: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "today", label: "Today", icon: CalendarDays },
  { id: "care", label: "Care", icon: HeartHandshake },
  { id: "home", label: "Home", icon: Home },
  { id: "handover", label: "Handover", icon: MessageSquareText },
  { id: "vault", label: "Vault", icon: Vault },
];

export function KinCueApp() {
  const { identity, signOut } = useKinCueAuth();
  const { activeSpace, spaces, setActiveSpaceId } = useFamilySpace();
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [toast, setToast] = useState<string | null>(null);

  const displayName = identity?.displayName ?? "Family member";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "KM";
  const heading = navItems.find((item) => item.id === activeTab)?.label ?? "Today";
  const roleLabel = (activeSpace?.role ?? "member").replaceAll("_", " ");

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  async function enableAlarms() {
    if (!("Notification" in window)) {
      notify("This browser does not support notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    notify(
      permission === "granted"
        ? "Notifications are enabled on this device."
        : "Notifications remain disabled.",
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><BellRing size={19} /></span>
          <span>KinCue</span>
        </div>
        <div className="space-switcher" title="Switch Family Space">
          <Users size={18} />
          <span><strong>{activeSpace?.name ?? "Family Space"}</strong><small>Private family space</small></span>
          <select
            aria-label="Active Family Space"
            onChange={(event) => setActiveSpaceId(event.target.value)}
            value={activeSpace?.familySpaceId ?? ""}
          >
            {spaces.map((space) => <option key={space.familySpaceId} value={space.familySpaceId}>{space.name}</option>)}
          </select>
          <ChevronDown size={15} />
        </div>
        <nav className="side-nav" aria-label="Primary navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button className={`nav-button ${activeTab === id ? "active" : ""}`} key={id} onClick={() => setActiveTab(id)} type="button" title={label}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-footer">
          <span className="avatar">{initials}</span>
          <div><strong>{displayName}</strong><small>{roleLabel}</small></div>
          <button className="sidebar-icon-button" onClick={() => void signOut()} type="button" title="Sign out"><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div>
            <h1 className="desktop-only">{heading}</h1>
          </div>
          <div className="top-actions">
            <button className="text-button desktop-only" onClick={enableAlarms} type="button"><Bell size={16} /> Enable notifications</button>
            <button className="icon-button mobile-only" onClick={enableAlarms} type="button" title="Enable notifications"><Bell size={18} /></button>
            <FamilyActivityButton />
            <FamilyMembersButton />
          </div>
        </header>

        {activeTab === "today" && (
          <TodayDashboard notify={notify} />
        )}

        {activeTab === "care" && (
          <CareProfiles notify={notify} />
        )}

        {activeTab === "home" && (
          <HomePlaybook notify={notify} />
        )}

        {activeTab === "handover" && (
          <HandoverWorkspace notify={notify} />
        )}

        {activeTab === "vault" && (
          <FamilyVault notify={notify} />
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ id, label, icon: Icon }) => <button className={activeTab === id ? "active" : ""} key={id} onClick={() => setActiveTab(id)} type="button"><Icon size={19} /><span>{label}</span></button>)}
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
