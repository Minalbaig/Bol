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
      <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-blue">Step 2 · Review AI</p>
      <h1 id="transcript-title" className="mt-2 text-[38px] font-bold tracking-[-0.035em] sm:text-[46px]">
        Make sure the words are yours.
      </h1>
      <p className="mt-3 max-w-[64ch] text-[17px] leading-relaxed text-slate">
        Fix the transcript or remove anything you do not want processed. Bol keeps this version unchanged so you can compare
        every AI suggestion against it.
      </p>

      {scenario && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-lav/20 bg-lav-soft px-3 py-1.5 text-sm font-semibold text-lav">
          <span aria-hidden="true">●</span> Fictional demo · {scenario.title.toLowerCase()}
        </p>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="surface-shadow rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <label htmlFor="transcript" className="text-[17px] font-bold">
            Your original words
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
            className="mt-3 w-full rounded-2xl border border-line bg-paper p-4 text-[17px] leading-[1.7]"
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
            <div className="reveal mt-3 rounded-2xl border border-line bg-mist p-4">
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
          <div className="surface-shadow rounded-2xl border border-blue/20 bg-surface p-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-blue">Before AI</p>
            <h2 className="mt-1 text-[20px] font-bold">You approve the source</h2>
            <p className="mt-1 text-sm text-slate">
              Next, AI will turn this text into small suggestions and show the words behind each one. You can still come back.
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
              <span>I have reviewed the text Bol will use.</span>
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
              Compare with AI
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
