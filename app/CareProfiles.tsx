"use client";

import { HeartHandshake, Pencil, Plus, UserRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  createCareProfile,
  subscribeToCareProfiles,
  updateCareProfile,
  type CareProfileInput,
} from "../src/firebase/care-profiles";
import type { CareProfile, FamilyMember } from "../src/firebase/models";
import { useKinCueAuth } from "./FirebaseAuth";
import { useFamilySpace } from "./FamilySpace";
import { CareRoutinesButton } from "./CareRoutines";
import { CareShifts } from "./CareShifts";
import { recordActivity } from "../src/firebase/activity";

const emptyForm: CareProfileInput = {
  linkedMemberUserId: "",
  fullName: "",
  preferredName: "",
  relationshipLabel: "",
  careNeedsSummary: "",
};

export function CareProfiles({ notify }: { notify: (message: string) => void }) {
  const { identity } = useKinCueAuth();
  const { activeSpace } = useFamilySpace();
  const [profiles, setProfiles] = useState<CareProfile[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loadedSpaceId, setLoadedSpaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CareProfile | null>(null);
  const [form, setForm] = useState<CareProfileInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const canCoordinate =
    activeSpace?.role === "owner" || activeSpace?.role === "primary_caregiver";
  const loading = loadedSpaceId !== activeSpace?.familySpaceId;

  useEffect(() => {
    if (!activeSpace) return;
    const familySpaceId = activeSpace.familySpaceId;

    return subscribeToCareProfiles(
      familySpaceId,
      (nextProfiles) => {
        setProfiles(nextProfiles.filter((profile) => profile.status === "active"));
        setLoadedSpaceId(familySpaceId);
        setError(null);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setLoadedSpaceId(familySpaceId);
      },
    );
  }, [activeSpace]);

  useEffect(() => {
    if (!activeSpace) return;
    return subscribeToMembers(activeSpace.familySpaceId, setMembers, (memberError) => {
      setError(memberError.message);
    });
  }, [activeSpace]);

  function openCreateDialog() {
    setEditingProfile(null);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(profile: CareProfile) {
    setEditingProfile(profile);
    setForm({
      linkedMemberUserId: profile.linkedMemberUserId ?? "",
      fullName: profile.fullName,
      preferredName: profile.preferredName ?? "",
      relationshipLabel: profile.relationshipLabel ?? "",
      careNeedsSummary: profile.careNeedsSummary ?? "",
    });
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
  }

  function changeField(field: keyof CareProfileInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSpace || !identity || !canCoordinate || !form.fullName.trim()) return;

    setSaving(true);
    setError(null);
    try {
      if (editingProfile) {
        await updateCareProfile(activeSpace.familySpaceId, editingProfile.id, form);
        void recordActivity(activeSpace.familySpaceId, identity, "care_profile_updated", `Updated care profile for ${form.preferredName.trim() || form.fullName.trim()}`);
        notify("Care profile updated.");
      } else {
        await createCareProfile(activeSpace.familySpaceId, identity.uid, form);
        void recordActivity(activeSpace.familySpaceId, identity, "care_profile_created", `Created care profile for ${form.preferredName.trim() || form.fullName.trim()}`);
        notify("Care profile created.");
      }
      setDialogOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The care profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Care profiles</p>
          <h2>Care</h2>
          <p>People whose care your family coordinates.</p>
        </div>
        {canCoordinate && (
          <button className="primary-button" onClick={openCreateDialog} type="button">
            <Plus size={17} /> Create care profile
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>People in your care</h3>
          <span>{loading ? "Loading" : `${profiles.length} ${profiles.length === 1 ? "profile" : "profiles"}`}</span>
        </div>
        {loading ? (
          <CareEmpty title="Loading care profiles..." body="" />
        ) : profiles.length === 0 ? (
          <CareEmpty
            title="No care profiles"
            body={canCoordinate ? "Create a profile to begin coordinating care." : "No profiles have been created in this Family Space."}
          />
        ) : (
          <ul className="care-profile-list">
            {profiles.map((profile) => {
              const shownName = profile.preferredName || profile.fullName;
              const initials = shownName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("");
              return (
                <li key={profile.id}>
                  <span className="profile-avatar">{initials || <UserRound size={20} />}</span>
                  <div className="care-profile-copy">
                    <div className="care-profile-title">
                      <strong>{shownName}</strong>
                      {profile.preferredName && profile.preferredName !== profile.fullName && <span>{profile.fullName}</span>}
                    </div>
                    <span>{profile.relationshipLabel || "Relationship not added"}</span>
                    {profile.linkedMemberUserId && <span className="account-link-label">Linked household account</span>}
                    {profile.careNeedsSummary && <p>{profile.careNeedsSummary}</p>}
                  </div>
                  <div className="care-profile-actions">
                    <CareRoutinesButton canCoordinate={canCoordinate} notify={notify} profile={profile} />
                    {canCoordinate && (
                      <button className="icon-button" onClick={() => openEditDialog(profile)} title={`Edit ${shownName}`} type="button">
                        <Pencil size={16} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error && !dialogOpen && !loading && <p className="panel-error" role="alert">{error}</p>}
      </div>

      <CareShifts canCoordinate={canCoordinate} members={members} notify={notify} profiles={profiles} />

      {dialogOpen && (
        <div className="modal-backdrop" onMouseDown={closeDialog} role="presentation">
          <section aria-labelledby="care-profile-dialog-title" aria-modal="true" className="member-dialog care-profile-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <header className="dialog-header">
              <div>
                <p className="eyebrow">Care profile</p>
                <h2 id="care-profile-dialog-title">{editingProfile ? "Edit profile" : "Create profile"}</h2>
              </div>
              <button className="icon-button" disabled={saving} onClick={closeDialog} title="Close" type="button"><X size={18} /></button>
            </header>
            <form className="profile-form" onSubmit={saveProfile}>
              <label htmlFor="care-linked-member">Household account</label>
              <select
                disabled={Boolean(editingProfile)}
                id="care-linked-member"
                onChange={(event) => changeField("linkedMemberUserId", event.target.value)}
                value={form.linkedMemberUserId}
              >
                <option value="">No linked account</option>
                {members
                  .filter((member) =>
                    member.userId === editingProfile?.linkedMemberUserId ||
                    !profiles.some((profile) => profile.linkedMemberUserId === member.userId),
                  )
                  .map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
              </select>

              <label htmlFor="care-full-name">Full name</label>
              <input autoComplete="name" id="care-full-name" maxLength={80} onChange={(event) => changeField("fullName", event.target.value)} required value={form.fullName} />

              <div className="profile-form-grid">
                <div>
                  <label htmlFor="care-preferred-name">Preferred name</label>
                  <input id="care-preferred-name" maxLength={50} onChange={(event) => changeField("preferredName", event.target.value)} value={form.preferredName} />
                </div>
                <div>
                  <label htmlFor="care-relationship">Relationship</label>
                  <input id="care-relationship" maxLength={50} onChange={(event) => changeField("relationshipLabel", event.target.value)} value={form.relationshipLabel} />
                </div>
              </div>

              <label htmlFor="care-context">Essential care context</label>
              <textarea id="care-context" maxLength={1000} onChange={(event) => changeField("careNeedsSummary", event.target.value)} rows={5} value={form.careNeedsSummary} />

              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="form-actions">
                <button className="secondary-button" disabled={saving} onClick={closeDialog} type="button">Cancel</button>
                <button className="primary-button" disabled={saving || !form.fullName.trim()} type="submit">
                  <HeartHandshake size={17} />{saving ? "Saving..." : "Save profile"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function subscribeToMembers(
  familySpaceId: string,
  onChange: (members: FamilyMember[]) => void,
  onError: (error: Error) => void,
) {
  let unsubscribe: (() => void) | undefined;
  let disposed = false;
  void import("../src/firebase/family-members").then(({ subscribeToFamilyMembers }) => {
    if (disposed) return;
    unsubscribe = subscribeToFamilyMembers(familySpaceId, onChange, onError);
  });
  return () => {
    disposed = true;
    unsubscribe?.();
  };
}

function CareEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="product-empty">
      <HeartHandshake size={28} />
      <h3>{title}</h3>
      {body && <p>{body}</p>}
    </div>
  );
}
