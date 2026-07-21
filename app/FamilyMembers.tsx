"use client";

import {
  Check,
  Copy,
  Mail,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { FamilyMember, FamilyRole } from "../src/firebase/models";
import { useKinCueAuth } from "./FirebaseAuth";
import { useFamilySpace } from "./FamilySpace";

const roleLabels: Record<FamilyRole, string> = {
  owner: "Owner",
  primary_caregiver: "Primary caregiver",
  helper: "Helper",
  viewer: "Viewer",
};

export function FamilyMembersButton() {
  const { getAccessToken } = useKinCueAuth();
  const { activeSpace } = useFamilySpace();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [role, setRole] = useState<Exclude<FamilyRole, "owner">>("helper");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !activeSpace) return;
    let unsubscribe: (() => void) | undefined;
    let disposed = false;

    void import("../src/firebase/family-members").then(
      ({ subscribeToFamilyMembers }) => {
        if (disposed) return;
        unsubscribe = subscribeToFamilyMembers(
          activeSpace.familySpaceId,
          (nextMembers) => {
            setMembers(nextMembers);
            setLoading(false);
            setError(null);
          },
          (subscriptionError) => {
            setError(subscriptionError.message);
            setLoading(false);
          },
        );
      },
    );

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [activeSpace, open]);

  function openDialog() {
    setLoading(true);
    setError(null);
    setOpen(true);
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSpace) return;
    setCreatingInvite(true);
    setInviteUrl(null);
    setError(null);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `/api/family-spaces/${activeSpace.familySpaceId}/invitations`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            email,
            relationshipLabel: relationship,
            role,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setInviteUrl(body.inviteUrl);
      setEmail("");
      setRelationship("");
    } catch (invitationError) {
      setError(
        invitationError instanceof Error
          ? invitationError.message
          : "The invitation could not be created.",
      );
    } finally {
      setCreatingInvite(false);
    }
  }

  async function copyInvitation() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button className="icon-button" onClick={openDialog} type="button" title="Family members">
        <Users size={18} />
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            aria-labelledby="family-members-title"
            aria-modal="true"
            className="member-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dialog-header">
              <div>
                <p className="eyebrow">{activeSpace?.name}</p>
                <h2 id="family-members-title">Family members</h2>
              </div>
              <button className="icon-button" onClick={() => setOpen(false)} type="button" title="Close"><X size={18} /></button>
            </header>

            <div className="member-dialog-body">
              <section className="member-section">
                <h3>Current members</h3>
                {loading ? (
                  <p className="muted-copy">Loading members...</p>
                ) : members.length === 0 ? (
                  <p className="muted-copy">No members have been added.</p>
                ) : (
                  <ul className="member-list">
                    {members.map((member) => (
                      <li key={member.userId}>
                        <span className="avatar">{member.displayName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                        <span><strong>{member.displayName}</strong><small>{member.relationshipLabel || member.email}</small></span>
                        <span className="role-label">{roleLabels[member.role]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {activeSpace?.role === "owner" && (
                <section className="member-section invite-section">
                  <h3><UserPlus size={17} /> Invite a member</h3>
                  <form className="invite-form" onSubmit={createInvitation}>
                    <label htmlFor="invite-email">Google account email</label>
                    <input id="invite-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
                    <div className="invite-grid">
                      <div>
                        <label htmlFor="invite-relationship">Relationship</label>
                        <input id="invite-relationship" maxLength={40} onChange={(event) => setRelationship(event.target.value)} placeholder="For example, Daughter" value={relationship} />
                      </div>
                      <div>
                        <label htmlFor="invite-role">Role</label>
                        <select id="invite-role" onChange={(event) => setRole(event.target.value as Exclude<FamilyRole, "owner">)} value={role}>
                          <option value="primary_caregiver">Primary caregiver</option>
                          <option value="helper">Helper</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </div>
                    </div>
                    <button className="primary-button" disabled={creatingInvite} type="submit"><Mail size={17} />{creatingInvite ? "Creating..." : "Create invitation link"}</button>
                  </form>

                  {inviteUrl && (
                    <div className="invite-result">
                      <input aria-label="Invitation link" readOnly value={inviteUrl} />
                      <button className="secondary-button" onClick={() => void copyInvitation()} type="button">
                        {copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                </section>
              )}

              {error && <p className="auth-error" role="alert">{error}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
