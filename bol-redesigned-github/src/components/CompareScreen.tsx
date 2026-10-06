"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAnalysis, getSummary } from "@/lib/clientApi";
import type { AnalyzedClaim, NotInferred } from "@/lib/schema";
import { useSession } from "./BolApp";
import { ClaimCard } from "./ClaimCard";
import { EvalDashboard } from "./EvalDashboard";
import { EvidenceTranscript } from "./EvidenceTranscript";
import { Button, ErrorNotice, FixtureLabel, Spinner } from "./ui";

const KIND_LABEL: Record<NotInferred["kind"], string> = {
  emotion: "Emotion",
  intent: "Intent",
  exact_time: "Exact time",
  legal: "Legal label",
  physical: "Physical contact",
  identity: "Identity",
  diagnosis: "Diagnosis",
  severity: "Severity",
  other: "Extra detail",
};

function representativeClaims(claims: AnalyzedClaim[]) {
  const chosen: AnalyzedClaim[] = [];
  const add = (claim: AnalyzedClaim | undefined) => {
    if (claim && !chosen.some((item) => item.id === claim.id)) chosen.push(claim);
  };
  add(claims.find((claim) => claim.evidenceType === "unsupported" || claim.evidenceType === "unknown"));
  add(claims.find((claim) => claim.evidenceType === "approximate"));
  add(claims.find((claim) => claim.evidenceType === "direct"));
  claims.forEach((claim) => {
    if (chosen.length < 3) add(claim);
  });
  return chosen;
}

export function CompareScreen() {
  const { state, dispatch, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const firstRequest = useRef(false);
  const baselineOnly = state.research.enabled && state.research.condition === "baseline";
  const analysis = state.analysis;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const options = { mode: state.mode, simulateFailure: state.simulateFailure };
    if (baselineOnly) {
      const summaryResult = await getSummary(state.transcript, options);
      setLoading(false);
      if (summaryResult.ok) dispatch({ type: "setSummary", result: summaryResult.data });
      else setError(summaryResult.error.message);
      return;
    }

    const [analysisResult, summaryResult] = await Promise.all([
      getAnalysis(state.transcript, options),
      state.summary ? Promise.resolve(null) : getSummary(state.transcript, options),
    ]);
    setLoading(false);
    if (analysisResult.ok) dispatch({ type: "setAnalysis", result: analysisResult.data });
    if (summaryResult?.ok) dispatch({ type: "setSummary", result: summaryResult.data });
    if (!analysisResult.ok) setError(analysisResult.error.message);
  }, [baselineOnly, dispatch, state.mode, state.simulateFailure, state.summary, state.transcript]);

  useEffect(() => {
    if (firstRequest.current || analysis || (baselineOnly && state.summary)) return;
    firstRequest.current = true;
    void run();
  }, [analysis, baselineOnly, run, state.summary]);

  const select = (id: string, scrollTo: "card" | "transcript") => {
    setSelectedId(id);
    if (state.research.enabled) dispatch({ type: "researchEvidenceOpened" });
    const target = scrollTo === "card" ? document.getElementById(`claim-${id}`) : document.getElementById("evidence-transcript");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: scrollTo === "card" ? "center" : "nearest" });
  };

  const counts = useMemo(() => {
    if (!analysis) return null;
    return {
      direct: analysis.claims.filter((claim) => claim.evidenceType === "direct").length,
      approximate: analysis.claims.filter((claim) => claim.evidenceType === "approximate").length,
      unsupported: analysis.claims.filter((claim) => claim.evidenceType === "unsupported" || claim.evidenceType === "unknown").length,
      pending: analysis.claims.filter((claim) => claim.userStatus === "pending").length,
      reviewed: analysis.claims.filter((claim) => claim.userStatus !== "pending").length,
    };
  }, [analysis]);

  const visibleClaims = analysis ? (showAll ? analysis.claims : representativeClaims(analysis.claims)) : [];
  const finish = () => dispatch({ type: "generateNarrative", at: new Date().toISOString(), now: Date.now() });

  if (baselineOnly) {
    return (
      <section className="mx-auto max-w-3xl">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-blue">Step 2 · Review AI</p>
        <h1 className="mt-2 text-[38px] font-bold tracking-[-0.035em]">Review the AI summary.</h1>
        {loading && <div className="mt-6"><Spinner label="Preparing the summary…" /></div>}
        {error && <div className="mt-6"><ErrorNotice message={error} onRetry={run} /></div>}
        {state.summary && (
          <div className="surface-shadow mt-6 rounded-2xl border border-line bg-surface p-6">
            <textarea
              value={state.summaryText}
              onChange={(event) => dispatch({ type: "editSummary", text: event.target.value })}
              rows={10}
              className="w-full rounded-2xl border border-line bg-paper p-4 text-[17px] leading-relaxed"
            />
            <Button variant="primary" className="mt-4" onClick={finish}>Finish review</Button>
          </div>
        )}
      </section>
    );
  }

  return (
    <div>
      <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-blue">Step 2 · Review AI</p>
      <h1 className="mt-2 max-w-[22ch] text-[38px] font-bold tracking-[-0.035em] sm:text-[46px]">
        See where AI stayed faithful—and where it did not.
      </h1>
      <p className="mt-3 max-w-[70ch] text-[17px] leading-relaxed text-slate">
        Bol breaks AI output into checkable suggestions. The labels are prompts to review, not verdicts about what happened.
      </p>

      {loading && (
        <div className="surface-shadow mt-7 rounded-2xl border border-blue/20 bg-surface p-6">
          <Spinner label="Comparing each AI suggestion with your original words…" />
        </div>
      )}
      {error && (
        <div className="mt-7 max-w-2xl"><ErrorNotice message={error} onRetry={run} /></div>
      )}

      {analysis && counts && (
        <div className="reveal mt-7">
          <div className="grid overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-3">
            <Metric value={counts.direct} label="Directly supported" tone="blue" />
            <Metric value={counts.approximate} label="Needs context" tone="amber" />
            <Metric value={counts.unsupported} label="Not in your words" tone="coral" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
              <section id="evidence-transcript" className="surface-shadow rounded-2xl border border-line bg-surface p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-blue">Your source</p>
                    <h2 className="mt-1 text-[21px] font-bold">Original words</h2>
                  </div>
                  {analysis.origin === "fixture" && <FixtureLabel />}
                </div>
                <p className="mt-2 text-sm text-slate">Select an underlined passage to see the AI suggestion linked to it.</p>
                <div className="mt-4 rounded-2xl border border-line bg-paper p-4">
                  <EvidenceTranscript
                    transcript={state.transcript}
                    claims={analysis.claims}
                    selectedId={selectedId}
                    onSelect={(id) => select(id, "card")}
                  />
                </div>
                <p className="mt-3 flex flex-wrap gap-3 text-[12px] text-slate" aria-label="Underline key">
                  <span><span className="ev-direct">solid</span> direct</span>
                  <span><span className="ev-approximate">wavy</span> approximate</span>
                  <span><span className="ev-unsupported">dashed</span> unsupported</span>
                </p>
              </section>

              {analysis.notInferred.length > 0 && (
                <section aria-labelledby="not-assumed-title" className="rounded-2xl border border-lav/25 bg-lav-soft/70 p-5">
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-lav">Restraint is a feature</p>
                  <h2 id="not-assumed-title" className="mt-1 text-[20px] font-bold">What AI did not assume</h2>
                  <ul className="mt-3 space-y-2">
                    {analysis.notInferred.slice(0, 4).map((item, index) => (
                      <li key={`${item.kind}-${index}`} className="text-[14px] leading-relaxed text-ink">
                        <span className="font-bold text-lav">{KIND_LABEL[item.kind]}:</span> {item.note}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {state.summary && (
                <details className="rounded-2xl border border-line bg-surface p-5">
                  <summary className="cursor-pointer font-bold text-ink">See a conventional AI summary</summary>
                  <p className="mt-2 text-sm leading-relaxed text-slate">
                    This fluent paragraph is included for comparison. Fluency can make added assumptions harder to notice.
                  </p>
                  <p className="mt-4 rounded-xl bg-paper p-4 text-[15px] leading-relaxed text-ink">{state.summaryText}</p>
                </details>
              )}
            </div>

            <section aria-labelledby="suggestions-title" className="surface-shadow rounded-2xl border border-blue/20 bg-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-blue">AI suggestions · not facts</p>
                  <h2 id="suggestions-title" className="mt-1 text-[24px] font-bold">Check what the AI wrote</h2>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    analysis.claims
                      .filter((claim) => claim.userStatus === "pending" && (claim.evidenceType === "direct" || claim.evidenceType === "approximate"))
                      .forEach((claim) => dispatch({ type: "claim", id: claim.id, action: { type: "accept" } }))
                  }
                >
                  Keep supported suggestions
                </Button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                Keep, rewrite or remove each suggestion. Unsupported wording stays out unless you explicitly keep it.
              </p>

              <div className="mt-5 space-y-3">
                {visibleClaims.map((claim) => (
                  <ClaimCard
                    key={claim.id}
                    claim={claim}
                    index={analysis.claims.findIndex((item) => item.id === claim.id)}
                    selected={selectedId === claim.id}
                    showTechnical={state.showTechnical}
                    onAction={(action) => dispatch({ type: "claim", id: claim.id, action })}
                    onViewSource={() => select(claim.id, "transcript")}
                  />
                ))}
              </div>

              {analysis.claims.length > 3 && (
                <Button variant="quiet" className="mt-4 w-full" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? "Show three key examples" : `Review all ${analysis.claims.length} suggestions`}
                </Button>
              )}

              {analysis.optionalQuestions.length > 0 && (
                <details className="mt-5 rounded-xl border border-line bg-paper p-4">
                  <summary className="cursor-pointer text-sm font-bold">Optional questions AI could ask</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate">
                    {analysis.optionalQuestions.map((question) => <li key={question}>{question}</li>)}
                  </ul>
                </details>
              )}
            </section>
          </div>

          {state.showTechnical && (
            <div className="mt-6"><EvalDashboard analysis={analysis} status={status} /></div>
          )}

          <div className="no-print sticky bottom-0 z-10 mt-8 border-t border-line bg-paper/95 py-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="quiet" onClick={() => dispatch({ type: "goto", step: "transcript" })}>Back to my words</Button>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate" aria-live="polite">
                  {counts.reviewed} reviewed · {counts.pending} left out for now
                </span>
                <Button variant="primary" onClick={finish}>Build my version <span aria-hidden="true">→</span></Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone: "blue" | "amber" | "coral" }) {
  const styles = {
    blue: "text-blue bg-blue-soft/55",
    amber: "text-amber bg-amber-soft/55",
    coral: "text-coral bg-coral-soft/60",
  }[tone];
  return (
    <div className={`border-b border-line p-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${styles}`}>
      <span className="text-[26px] font-bold tabular-nums">{value}</span>
      <span className="ml-2 text-sm font-semibold">{label}</span>
    </div>
  );
}
