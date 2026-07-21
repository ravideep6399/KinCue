"use client";

import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Home, Plus, ShieldCheck } from "lucide-react";
import type { FamilySpaceMembership } from "../src/firebase/models";
import { useKinCueAuth } from "./FirebaseAuth";

type FamilySpaceState = {
  spaces: FamilySpaceMembership[];
  activeSpace: FamilySpaceMembership | null;
  status: "loading" | "ready" | "creating" | "error";
  error: string | null;
  setActiveSpaceId: (id: string) => void;
  createSpace: (name: string) => Promise<void>;
};

const FamilySpaceContext = createContext<FamilySpaceState | null>(null);

export function FamilySpaceProvider({ children }: { children: ReactNode }) {
  const { identity, status: authStatus } = useKinCueAuth();
  const [spaces, setSpaces] = useState<FamilySpaceMembership[]>([]);
  const [activeSpaceId, setActiveSpaceIdState] = useState<string | null>(null);
  const [status, setStatus] = useState<FamilySpaceState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity || authStatus === "loading") return;
    let unsubscribe: (() => void) | undefined;
    let disposed = false;

    void import("../src/firebase/family-spaces").then(
      ({ subscribeToFamilySpaces }) => {
        if (disposed) return;
        unsubscribe = subscribeToFamilySpaces(
          identity.uid,
          (nextSpaces) => {
            setSpaces(nextSpaces);
            setActiveSpaceIdState((current) => {
              if (current && nextSpaces.some((space) => space.familySpaceId === current)) {
                return current;
              }
              const stored = window.localStorage.getItem(`kincue-space:${identity.uid}`);
              return nextSpaces.some((space) => space.familySpaceId === stored)
                ? stored
                : nextSpaces[0]?.familySpaceId ?? null;
            });
            if (nextSpaces.length > 0) setError(null);
            setStatus("ready");
          },
          (subscriptionError) => {
            setError(subscriptionError.message);
            setStatus("error");
          },
        );
      },
    );

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [authStatus, identity]);

  const activeSpace =
    spaces.find((space) => space.familySpaceId === activeSpaceId) ?? null;

  const value = useMemo<FamilySpaceState>(
    () => ({
      spaces,
      activeSpace,
      status,
      error,
      setActiveSpaceId(id) {
        setActiveSpaceIdState(id);
        if (identity) {
          window.localStorage.setItem(`kincue-space:${identity.uid}`, id);
        }
      },
      async createSpace(name) {
        if (!identity || !name.trim()) return;
        setStatus("creating");
        setError(null);
        try {
          const { createFamilySpace } = await import("../src/firebase/family-spaces");
          const created = await createFamilySpace({
            uid: identity.uid,
            email: identity.email,
            displayName: identity.displayName,
            name,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
          setSpaces((current) =>
            current.some((space) => space.familySpaceId === created.familySpaceId)
              ? current
              : [...current, created],
          );
          setActiveSpaceIdState(created.familySpaceId);
          window.localStorage.setItem(
            `kincue-space:${identity.uid}`,
            created.familySpaceId,
          );
        } catch (creationError) {
          setError(
            creationError instanceof Error
              ? creationError.message
              : "The Family Space could not be created.",
          );
          setStatus("error");
        }
      },
    }),
    [activeSpace, error, identity, spaces, status],
  );

  return <FamilySpaceContext.Provider value={value}>{children}</FamilySpaceContext.Provider>;
}

export function useFamilySpace() {
  const value = useContext(FamilySpaceContext);
  if (!value) throw new Error("useFamilySpace must be used inside FamilySpaceProvider.");
  return value;
}

export function FamilySpaceGate({ children }: { children: ReactNode }) {
  const { activeSpace, status, error, createSpace } = useFamilySpace();
  const [name, setName] = useState("");

  if (status === "loading") {
    return <main className="auth-screen"><div className="auth-status">Loading your family spaces...</div></main>;
  }

  if (activeSpace) return children;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createSpace(name);
  }

  return (
    <main className="auth-screen">
      <form className="auth-panel family-setup" onSubmit={submit}>
        <span className="auth-mark"><Home size={24} /></span>
        <p className="eyebrow">Family setup</p>
        <h1>Create your Family Space</h1>
        <p>This private space will hold your family members, care shifts, cues, and household knowledge.</p>
        <label htmlFor="family-name">Family Space name</label>
        <input
          id="family-name"
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your family name"
          required
          value={name}
        />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button auth-button" disabled={status === "creating"} type="submit">
          {status === "creating" ? <ShieldCheck size={18} /> : <Plus size={18} />}
          {status === "creating" ? "Creating..." : "Create Family Space"}
        </button>
      </form>
    </main>
  );
}
