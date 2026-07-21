"use client";

import { CheckCircle2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useKinCueAuth } from "../../FirebaseAuth";

type InvitationPreview = {
  familySpaceName: string;
  role: string;
  relationshipLabel: string | null;
};

export function InviteAcceptance({ token }: { token: string }) {
  const { getAccessToken } = useKinCueAuth();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "accepting" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void getAccessToken()
      .then(async (accessToken) => {
        const response = await fetch(`/api/invitations/${token}`, {
          headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (!disposed) {
          setPreview(body);
          setStatus("ready");
        }
      })
      .catch((previewError) => {
        if (disposed) return;
        setError(previewError instanceof Error ? previewError.message : "The invitation could not be loaded.");
        setStatus("error");
      });

    return () => {
      disposed = true;
    };
  }, [getAccessToken, token]);

  async function acceptInvitation() {
    setStatus("accepting");
    setError(null);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/invitations/${token}`, {
        method: "POST",
        headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.assign("/");
    } catch (acceptanceError) {
      setError(acceptanceError instanceof Error ? acceptanceError.message : "The invitation could not be accepted.");
      setStatus("error");
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel invite-acceptance">
        <span className="auth-mark"><Users size={24} /></span>
        <p className="eyebrow">Family invitation</p>
        {status === "loading" ? (
          <h1>Loading invitation...</h1>
        ) : preview ? (
          <>
            <h1>Join {preview.familySpaceName}</h1>
            <p>You will join as {preview.relationshipLabel || preview.role.replace("_", " ")}.</p>
            <button className="primary-button auth-button" disabled={status === "accepting"} onClick={() => void acceptInvitation()} type="button">
              <CheckCircle2 size={18} />{status === "accepting" ? "Joining..." : "Accept invitation"}
            </button>
          </>
        ) : null}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
