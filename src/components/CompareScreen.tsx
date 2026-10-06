"use client";

import { useState } from "react";
import { getAnalysis } from "@/lib/clientApi";
import { findFixtureForTranscript } from "@/lib/fixtures";
import type { NotInferred } from "@/lib/schema";
import { useSession } from "./BolApp";
import { BaselinePanel } from "./BaselinePanel";
import { ClaimCard } from "./ClaimCard";
import { EvalDashboard } from "./EvalDashboard";
import { EvidenceTranscript } from "./EvidenceTranscript";
import { Button, ErrorNotice, FixtureLabel, Spinner } from "./ui";

const KIND_LABEL: Record<NotInferred["kind"], string> = {
  emotion: "Emotional state",
  intent: "Intent or motive",
  exact_time: "Exact time",
  legal: "Legal classification",
  physical: "Physical contact",
  identity: "Identity",
  diagnosis: "Diagnosis",
  severity: "Severity",
  other: "Approximate detail",
};

export function CompareScreen() {
  const { state, dispatch, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const research = state.research.enabled;
  const baselineOnly = research && state.research.condition === "baseline";
  // In research mode each participant sees one condition only.
  const showBaseline = !research || baselineOnly;
  const analysis = state.analysis;
  const fixtureAvailable = Boolean(findFixtureForTranscript(state.transcript));

  const run = async () => {
    setLoading(true);
    setError(null);
    const r = await getAnalysis(state.transcript, { mode: state.mode, simulateFailure: state.simulateFailure });
    setLoading(false);
    if (r.ok) dispatch({ type: "setAnalysis", result: r.data });
    else setError(r.error.message);
  };

  const select = (id: string, scrollTo: "card" | "transcript") => {
    setSelectedId(id);
    if (research) dispatch({ type: "researchEvidenceOpened" });
    const target = scrollTo === "card" ? document.getElementById(`claim-${id}`) : document.getElementById("evidence-transcript");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: scrollTo === "card" ? "center" : "nearest" });
  };

  const counts = analysis
    ? {
        pending: analysis.claims.filter((c) => c.userStatus === "pending").length,
        reviewed: analysis.claims.filter((c) => c.userStatus !== "pending").length,
      }
    : null;

  const finish = () => dispatch({ type: "generateNarrative", at: new Date().toISOString(), now: Date.now() });

  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-[-0.02em]">{baselineOnly ? "Review the summary" : "Compare and review"}</h1>
      <p className="mt-2 max-w-[70ch] text-[17px] text-slate">
        {baselineOnly
          ? "Read the AI summary of your confirmed transcript. You can edit it before finishing."
          : research
            ? "Review each claim Bol drew from your confirmed transcript. Bol's checks can be wrong; you decide what stays."
            : "The same confirmed transcript, processed two ways. Neither result is automatically correct: a fluent summary is not necessarily a faithful one, and Bol's checks can also be wrong. You decide what stays."}
      </p>

      <div className={`mt-7 grid gap-6 ${research ? "" : "xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"}`}>
        {showBaseline && (
          <div className={baselineOnly ? "max-w-3xl" : "xl:sticky xl:top-4 xl:self-start"}>
            <BaselinePanel showAudit={!research} />
          </div>
        )}

        {!baselineOnly && (
          <section aria-labelledby="bol-title" className="rounded-2xl border border-blue/25 bg-surface p-5 sm:p-6">
            <h2 id="bol-title" className="text-[22px] font-bold tracking-[-0.01em]">
              Bol Evidence Map
            </h2>
            <p className="mt-1 text-[15px] text-slate">
              The transcript divided into single claims. Each claim links to the exact words it came from and shows whether
              those words state it directly, approximately, or not at all.
            </p>

            {!analysis && !loading && (
              <Button variant="primary" className="mt-5" onClick={run}>
                Generate Bol evidence map
              </Button>
            )}
            {loading && (
              <div className="mt-5">
                <Spinner label="Extracting claims, checking sources and running the independent verifier…" />
              </div>
            )}
            {error && (
              <div className="mt-4">
                <ErrorNotice
                  message={error}
                  onRetry={run}
                  extra={
                    state.mode === "live" && fixtureAvailable ? (
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => {
                          dispatch({ type: "setMode", mode: "fixture" });
                          dispatch({ type: "setSimulateFailure", value: false });
                          setError(null);
                        }}
                      >
                        Use precomputed demonstration output
                      </Button>
                    ) : null
                  }
                />
              </div>
            )}

            {analysis && (
              <div className="reveal mt-5 space-y-6">
                {analysis.origin === "fixture" && <FixtureLabel />}

                <div id="evidence-transcript" className="rounded-xl border border-line bg-paper p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-slate">Your confirmed transcript</h3>
                    <p className="flex flex-wrap gap-3 text-[13px] text-slate" aria-label="Underline key">
                      <span><span className="ev-direct">solid</span> direct</span>
                      <span><span className="ev-approximate">wavy</span> approximate</span>
                      <span><span className="ev-unsupported">dashed</span> unsupported</span>
                    </p>
                  </div>
                  <div className="mt-2">
                    <EvidenceTranscript
                      transcript={state.transcript}
                      claims={analysis.claims}
                      selectedId={selectedId}
                      onSelect={(id) => select(id, "card")}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-[17px] font-semibold">Claims ({analysis.claims.length})</h3>
                  <p className="mt-1 text-sm text-slate">
                    Accept, edit, reject or mark each claim as uncertain. Only accepted and edited claims go into your narrative.
                    Unsupported claims stay out unless you choose to keep them.
                  </p>
                  <div className="mt-3 space-y-3">
                    {analysis.claims.map((c, i) => (
                      <ClaimCard
                        key={c.id}
                        claim={c}
                        index={i}
                        selected={selectedId === c.id}
                        showTechnical={state.showTechnical}
                        onAction={(action) => dispatch({ type: "claim", id: c.id, action })}
                        onViewSource={() => select(c.id, "transcript")}
                      />
                    ))}
                  </div>
                </div>

                {analysis.notInferred.length > 0 && (
                  <section aria-labelledby="not-assumed-title" className="rounded-xl border border-lav/30 bg-lav-soft/50 p-5">
                    <h3 id="not-assumed-title" className="text-[19px] font-bold">
                      What Bol did not assume
                    </h3>
                    <p className="mt-1 text-sm text-slate">Interpretations a reader might make about this account that Bol left out.</p>
                    <ul className="mt-3 space-y-3">
                      {analysis.notInferred.map((n, i) => (
                        <li key={`${n.kind}-${i}`} className="text-[15px]">
                          <span className="font-semibold text-lav">{KIND_LABEL[n.kind]}.</span> {n.note}
                          {n.relatedExcerpt && <span className="block text-sm text-slate">Related words: &ldquo;{n.relatedExcerpt}&rdquo;</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {analysis.optionalQuestions.length > 0 && (
                  <section aria-labelledby="optional-title" className="rounded-xl border border-line p-5">
                    <h3 id="optional-title" className="text-[15px] font-semibold">
                      Optional prompts
                    </h3>
                    <p className="text-sm text-slate">You do not need to answer these. Nothing is missing if you leave them.</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
                      {analysis.optionalQuestions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {state.showTechnical && analysis && !baselineOnly && (
        <div className="mt-6">
          <EvalDashboard analysis={analysis} status={status} />
        </div>
      )}

      <div className="no-print sticky bottom-0 z-10 mt-8 border-t border-line bg-paper/95 py-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="quiet" onClick={() => dispatch({ type: "goto", step: "transcript" })}>
            Back to transcript
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            {counts && (
              <span className="text-sm text-slate" aria-live="polite">
                {counts.reviewed} reviewed, {counts.pending} not reviewed
                {counts.pending > 0 && " (left out of the narrative)"}
              </span>
            )}
            <Button
              variant="primary"
              disabled={baselineOnly ? !state.summary : !analysis}
              onClick={finish}
            >
              {baselineOnly ? "Finish review" : "Build my narrative"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
