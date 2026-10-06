"use client";

import { useState } from "react";
import { getAudit, getSummary } from "@/lib/clientApi";
import { findFixtureForTranscript } from "@/lib/fixtures";
import { useSession } from "./BolApp";
import { Button, ErrorNotice, EvidenceBadge, FixtureLabel, Spinner } from "./ui";

export function BaselinePanel({ showAudit = true }: { showAudit?: boolean }) {
  const { state, dispatch } = useSession();
  const [loading, setLoading] = useState<"summary" | "audit" | null>(null);
  const [error, setError] = useState<{ step: "summary" | "audit"; message: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [openStatement, setOpenStatement] = useState<string | null>(null);

  const opts = { mode: state.mode, simulateFailure: state.simulateFailure };
  const fixtureAvailable = Boolean(findFixtureForTranscript(state.transcript));

  const generate = async () => {
    setLoading("summary");
    setError(null);
    const r = await getSummary(state.transcript, opts);
    setLoading(null);
    if (r.ok) dispatch({ type: "setSummary", result: r.data });
    else setError({ step: "summary", message: r.error.message });
  };

  const audit = async () => {
    setLoading("audit");
    setError(null);
    const r = await getAudit(state.transcript, state.summaryText, opts);
    setLoading(null);
    if (r.ok) dispatch({ type: "setAudit", result: r.data });
    else setError({ step: "audit", message: r.error.message });
  };

  const usePrecomputed = () => {
    dispatch({ type: "setMode", mode: "fixture" });
    dispatch({ type: "setSimulateFailure", value: false });
    setError(null);
  };

  return (
    <section aria-labelledby="baseline-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="baseline-title" className="text-[22px] font-bold tracking-[-0.01em]">
        Conventional AI Summary
      </h2>
      <p className="mt-1 text-[15px] text-slate">
        A standard neutral summary of the same transcript. It is editable, but it does not show where each statement came from.
      </p>

      <div className="mt-5">
        {!state.summary && loading !== "summary" && (
          <Button variant="primary" onClick={generate}>
            Generate conventional summary
          </Button>
        )}
        {loading === "summary" && <Spinner label="Generating summary…" />}
        {error?.step === "summary" && (
          <div className="mt-3">
            <ErrorNotice
              message={error.message}
              onRetry={generate}
              extra={
                state.mode === "live" && fixtureAvailable ? (
                  <Button size="sm" variant="quiet" onClick={usePrecomputed}>
                    Use precomputed demonstration output
                  </Button>
                ) : null
              }
            />
          </div>
        )}
      </div>

      {state.summary && (
        <div className="reveal">
          {state.summary.origin === "fixture" && <FixtureLabel className="mb-3" />}
          {editing ? (
            <div>
              <label htmlFor="summary-edit" className="text-sm font-semibold">
                Edit summary
              </label>
              <textarea
                id="summary-edit"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={7}
                className="mt-1 w-full rounded-lg border border-line bg-paper p-3 text-[16px] leading-relaxed"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!draft.trim()}
                  onClick={() => {
                    if (draft !== state.summaryText) dispatch({ type: "editSummary", text: draft.trim() });
                    setEditing(false);
                  }}
                >
                  Save summary
                </Button>
                <Button size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-[17px] leading-[1.7] text-ink">{state.summaryText}</p>
          )}
          {!editing && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setDraft(state.summaryText);
                  setEditing(true);
                }}
              >
                Edit summary
              </Button>
              {showAudit && !state.audit && (
                <Button size="sm" onClick={audit} disabled={loading === "audit"}>
                  Check this summary with Bol&rsquo;s verifier
                </Button>
              )}
            </div>
          )}
          {state.summaryText !== state.summary.summary && (
            <p className="mt-2 text-sm text-slate">You have edited this summary.</p>
          )}
          {state.summary.ms !== null && state.showTechnical && (
            <p className="mt-2 text-[13px] text-slate">Generated live in {(state.summary.ms / 1000).toFixed(1)} s.</p>
          )}
        </div>
      )}

      {loading === "audit" && <div className="mt-4"><Spinner label="Checking each statement against the transcript…" /></div>}
      {error?.step === "audit" && (
        <div className="mt-3">
          <ErrorNotice message={error.message} onRetry={audit} />
        </div>
      )}

      {showAudit && state.audit && (
        <div className="reveal mt-6 border-t border-line pt-5">
          <h3 className="text-[17px] font-semibold">After checking</h3>
          <p className="mt-1 text-sm text-slate">
            Each sentence of the summary, compared with the transcript after the summary was written.
          </p>
          {state.audit.origin === "fixture" && <FixtureLabel className="mt-2" />}
          <ol className="mt-3 space-y-3">
            {state.audit.statements.map((st) => (
              <li key={st.id} className={`rounded-lg border p-3 ${st.verdict === "unsupported" ? "border-dashed border-[#6b7280]" : "border-line"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <EvidenceBadge type={st.verdict} />
                </div>
                <p className="mt-2 text-[15px] text-ink">{st.text}</p>
                <p className="mt-1 text-sm text-slate">{st.explanation}</p>
                {st.guardFlags.length > 0 && st.guardFlags[0]!.message !== st.explanation && (
                  <p className="mt-1 text-sm text-[#3f4553]">⊘ {st.guardFlags[0]!.message}</p>
                )}
                {st.match.matchedText && (
                  <>
                    <button
                      type="button"
                      aria-expanded={openStatement === st.id}
                      onClick={() => {
                        if (openStatement !== st.id && state.research.enabled) dispatch({ type: "researchEvidenceOpened" });
                        setOpenStatement(openStatement === st.id ? null : st.id);
                      }}
                      className="mt-2 text-sm font-semibold text-blue underline-offset-4 hover:underline"
                    >
                      {openStatement === st.id ? "Hide source" : "View source"}
                    </button>
                    {openStatement === st.id && (
                      <blockquote className="mt-1 rounded-md border-l-4 border-blue bg-blue-soft/60 p-2 text-[15px]">
                        &ldquo;{st.match.matchedText}&rdquo;
                      </blockquote>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
