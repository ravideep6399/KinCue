"use client";

import { CircleAlert, MessageSquareText, Mic, Save, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HandoverExtraction } from "../src/ai/schemas";
import { saveHandover, subscribeToHandovers } from "../src/firebase/handovers";
import type { HandoverRecord } from "../src/firebase/models";
import { useKinCueAuth } from "./FirebaseAuth";
import { useFamilySpace } from "./FamilySpace";
import { recordActivity } from "../src/firebase/activity";

export function HandoverWorkspace({ notify }: { notify: (message: string) => void }) {
  const { identity, getAccessToken } = useKinCueAuth();
  const { activeSpace } = useFamilySpace();
  const [transcript, setTranscript] = useState("");
  const [extraction, setExtraction] = useState<HandoverExtraction | null>(null);
  const [extractionMode, setExtractionMode] = useState<"local-rules" | "local-fallback" | "openai" | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [saving, setSaving] = useState(false);
  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canContribute = activeSpace?.role !== "viewer";

  useEffect(() => {
    if (!activeSpace) return;
    return subscribeToHandovers(activeSpace.familySpaceId, setHandovers, (subscriptionError) => setError(subscriptionError.message));
  }, [activeSpace]);

  async function structureHandover() {
    setExtracting(true);
    setExtraction(null);
    setExtractionMode(null);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/handovers/extract", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ familySpaceId: activeSpace?.familySpaceId, transcript }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setExtraction(body.extraction);
      setExtractionMode(
        body.mode === "local-rules" || body.mode === "local-fallback"
          ? body.mode
          : "openai",
      );
      if (body.warning) notify(body.warning);
      notify("The handover is ready for review.");
    } catch (extractionError) {
      setError(extractionError instanceof Error ? extractionError.message : "The handover could not be structured.");
    } finally {
      setExtracting(false);
    }
  }

  async function confirmHandover() {
    if (!activeSpace || !identity || !extraction) return;
    setSaving(true);
    setError(null);
    try {
      await saveHandover(activeSpace.familySpaceId, identity, transcript, extraction);
      void recordActivity(activeSpace.familySpaceId, identity, "handover_saved", "Saved a reviewed caregiver handover");
      setTranscript("");
      setExtraction(null);
      setExtractionMode(null);
      notify("Reviewed handover saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The handover could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      notify("Speech capture is not supported by this browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = navigator.language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const spoken = event.results[0]?.[0]?.transcript?.trim();
      if (spoken) setTranscript((current) => `${current}${current.trim() ? " " : ""}${spoken}`);
    };
    recognition.onerror = () => {
      setRecording(false);
      notify("Speech capture stopped before a transcript was received.");
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  return (
    <section className="content">
      <div className="page-heading"><div><p className="eyebrow">Structured handover</p><h2>Structure a caregiver update</h2><p>Review every extracted item before saving it to your Family Space.</p></div></div>
      <div className="handover-grid">
        <div className="panel">
          <div className="panel-header"><h3>Caregiver update</h3><span>Draft</span></div>
          <div className="composer">
            <label htmlFor="handover-text">Speak or type what changed</label>
            <textarea disabled={!canContribute} id="handover-text" placeholder="Enter a handover update" value={transcript} onChange={(event) => setTranscript(event.target.value)} />
            {canContribute && (
              <div className="composer-actions">
                <button className="secondary-button" onClick={toggleRecording} type="button"><Mic size={17} />{recording ? "Stop" : "Record"}</button>
                <button className="primary-button" disabled={extracting || transcript.trim().length < 12} onClick={() => void structureHandover()} type="button"><Sparkles size={17} />{extracting ? "Structuring..." : "Structure handover"}</button>
              </div>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><h3>Proposed briefing</h3><span>{extraction ? `${extraction.items.length} items | ${extractionMode === "openai" ? "OpenAI" : extractionMode === "local-fallback" ? "Local fallback" : "Local"}` : "Waiting"}</span></div>
          {!extraction ? (
            <div className="product-empty"><Sparkles size={28} /><h3>Nothing to review</h3><p>Structured proposals will appear after a handover is submitted.</p></div>
          ) : (
            <div>
              <div className="extraction-summary">{extraction.summary}</div>
              {extraction.items.map((item, index) => (
                <div className="extracted-item" key={`${item.type}-${index}`}>
                  <div className="extracted-top"><strong>{item.title}</strong><span className="source-chip">Source preserved</span></div>
                  <div className="field-grid"><div><span>Person</span><br />{item.person ?? "Not stated"}</div><div><span>Time</span><br />{item.scheduledTime ?? "Not stated"}</div><div><span>Condition</span><br />{item.condition ?? "Not stated"}</div><div><span>Confidence</span><br />{item.confidence}</div></div>
                  {item.warnings.map((warning) => <div className="warning-line" key={warning}><CircleAlert size={14} />{warning}</div>)}
                </div>
              ))}
              <div className="confirm-row"><button className="primary-button" disabled={saving} onClick={() => void confirmHandover()} type="button"><Save size={17} />{saving ? "Saving..." : "Confirm and save"}</button></div>
            </div>
          )}
        </div>
      </div>
      {error && <p className="standalone-error" role="alert">{error}</p>}
      <div className="panel handover-history">
        <div className="panel-header"><h3>Recent handovers</h3><span>{handovers.length}</span></div>
        {handovers.length === 0 ? (
          <div className="history-empty"><MessageSquareText size={22} /><span>No saved handovers</span></div>
        ) : (
          <ul className="handover-list">{handovers.map((handover) => <li key={handover.id}><strong>{handover.summary}</strong><span>{handover.createdByDisplayName} | {formatDate(handover.createdAt)}</span></li>)}</ul>
        )}
      </div>
    </section>
  );
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function formatDate(value: unknown) {
  const date = value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate() as Date : new Date(String(value));
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date) : "Saving...";
}
