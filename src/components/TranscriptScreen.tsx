"use client";

import { useEffect, useRef, useState } from "react";
import { detectIdentifyingDetails, redactAll, redactRange, type DetectedDetail } from "@/lib/redaction";
import { findFixtureForTranscript, getScenario } from "@/lib/fixtures";
import { useSession } from "./BolApp";
import { Button } from "./ui";

export function TranscriptScreen() {
  const { state, dispatch, requestDelete } = useSession();
  const [draft, setDraft] = useState(state.transcript);
  const [confirmed, setConfirmed] = useState(state.transcriptConfirmed);
  const [detected, setDetected] = useState<DetectedDetail[] | null>(null);
  const [notice, setNotice] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = draft !== state.transcript;

  // Commit typing to session state after a short pause, so undo works in sensible steps.
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => dispatch({ type: "setTranscript", text: draft }), 700);
    return () => clearTimeout(id);
  }, [draft, dirty, dispatch]);

  const commit = (text: string) => {
    setDraft(text);
    setConfirmed(false);
    setDetected(null);
    dispatch({ type: "setTranscript", text });
  };

  const undo = () => {
    if (dirty) {
      setDraft(state.transcript);
      setNotice("Undid unsaved typing.");
      return;
    }
    const prev = state.history[state.history.length - 1];
    if (prev === undefined) return;
    setDraft(prev);
    setConfirmed(false);
    setDetected(null);
    dispatch({ type: "undo" });
    setNotice("Undid the last change.");
  };

  const redactSelection = () => {
    const el = areaRef.current;
    if (!el || el.selectionStart === el.selectionEnd) {
      setNotice("Select the words you want to redact in the transcript first.");
      return;
    }
    commit(redactRange(draft, el.selectionStart, el.selectionEnd));
    setNotice("Selected text redacted.");
  };

  const scenario = state.scenarioId ? getScenario(state.scenarioId) : undefined;
  const fixtureStillApplies = Boolean(findFixtureForTranscript(draft));
  const canConfirm = draft.trim().length > 0 && confirmed;

  return (
    <section aria-labelledby="transcript-title">
      <h1 id="transcript-title" className="text-[32px] font-bold tracking-[-0.02em]">
        Review the transcript
      </h1>
      <p className="mt-2 max-w-[64ch] text-[17px] text-slate">
        This is the text Bol will work from. Change anything that is wrong, remove anything you would rather not share, and
        confirm only when it reflects what you want processed. Bol will not change this text itself.
      </p>

      {scenario && (
        <p className="mt-4 inline-block rounded-md bg-mist px-3 py-1.5 text-sm text-slate">
          Fictional demonstration: {scenario.title.toLowerCase()}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-xl border border-line bg-surface p-5">
          <label htmlFor="transcript" className="font-semibold">
            Transcript
          </label>
          <textarea
            id="transcript"
            ref={areaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setConfirmed(false);
            }}
            rows={10}
            maxLength={12000}
            lang="en"
            className="mt-2 w-full rounded-lg border border-line bg-paper p-4 text-[17px] leading-[1.7]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={undo} disabled={!dirty && state.history.length === 0}>
              Undo
            </Button>
            <Button size="sm" onClick={redactSelection}>
              Redact selected text
            </Button>
            <Button size="sm" onClick={() => setDetected(detectIdentifyingDetails(draft))}>
              Detect possible identifying details
            </Button>
          </div>
          <p aria-live="polite" className="mt-2 min-h-5 text-sm text-slate">
            {notice}
          </p>

          {detected && (
            <div className="reveal mt-3 rounded-lg border border-line bg-mist p-4">
              {detected.length === 0 ? (
                <p className="text-[15px]">
                  No common identifying patterns were found. This check looks for things like phone numbers, emails, ID numbers
                  and addresses; it can miss details, so please read the text yourself too.
                </p>
              ) : (
                <>
                  <p className="text-[15px] font-semibold">{detected.length} possible identifying detail(s)</p>
                  <ul className="mt-2 space-y-2">
                    {detected.map((d) => (
                      <li key={`${d.start}-${d.end}`} className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
                        <span>
                          <span className="text-slate">{d.label}:</span> <span className="font-semibold">{d.text}</span>
                        </span>
                        <Button
                          size="sm"
                          onClick={() => {
                            commit(redactRange(draft, d.start, d.end));
                            setNotice(`${d.label} redacted.`);
                          }}
                        >
                          Redact
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      commit(redactAll(draft, detected));
                      setNotice("All detected details redacted.");
                    }}
                  >
                    Redact all
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-semibold">Before analysis</h2>
            <p className="mt-1 text-sm text-slate">
              After you confirm, the transcript is sent to AI services to create a summary and an evidence map. You can still
              come back and change it.
            </p>
            {state.mode === "fixture" && !fixtureStillApplies && (
              <p className="mt-3 rounded-md bg-[#fbf6e6] p-3 text-sm text-[#5c4a12]">
                Demo controls are set to precomputed output, which only exists for the unedited demonstration transcripts. Switch
                to live APIs to analyse this text.
              </p>
            )}
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-[15px]">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-[#2f5585]"
                checked={confirmed}
                disabled={!draft.trim()}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>This transcript reflects what I want Bol to process.</span>
            </label>
            <Button
              variant="primary"
              className="mt-4 w-full"
              disabled={!canConfirm}
              onClick={() => {
                if (dirty) dispatch({ type: "setTranscript", text: draft });
                dispatch({ type: "confirmTranscript", value: true });
                dispatch({ type: "goto", step: "compare" });
              }}
            >
              Confirm transcript
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={() => dispatch({ type: "goto", step: "input" })}>
              Back
            </Button>
            <Button variant="danger" onClick={requestDelete}>
              Delete session
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}
