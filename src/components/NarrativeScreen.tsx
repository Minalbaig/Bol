"use client";

import { useMemo, useState } from "react";
import { buildNarrative, narrativeToJSON, narrativeToText, NARRATIVE_TITLE, type NarrativeLine } from "@/lib/narrative";
import { researchExport } from "@/lib/metrics";
import type { ResearchRatings } from "@/lib/session";
import { useSession } from "./BolApp";
import { Button, FixtureLabel } from "./ui";

function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Section({
  title,
  description,
  lines,
  tone,
  showSource,
}: {
  title: string;
  description: string;
  lines: (NarrativeLine & { reason?: string })[];
  tone: "confirmed" | "approximate" | "kept" | "uncertain" | "excluded";
  showSource?: boolean;
}) {
  if (lines.length === 0) return null;
  const border = {
    confirmed: "border-blue",
    approximate: "border-lav",
    kept: "border-[#6b7280] border-dashed",
    uncertain: "border-lav border-dotted",
    excluded: "border-line",
  }[tone];
  return (
    <section className={`border-l-4 pl-4 ${border}`} aria-label={title}>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      <p className="text-sm text-slate">{description}</p>
      <ul className={`mt-2 space-y-2 ${tone === "excluded" ? "text-slate" : "text-ink"}`}>
        {lines.map((l) => (
          <li key={l.id} className="text-[16px] leading-relaxed">
            <span className={tone === "excluded" ? "line-through decoration-1" : ""}>{l.text}</span>
            {(l.note || l.reason) && <span className="ml-1 text-sm text-slate">({l.reason ?? l.note})</span>}
            {showSource && l.sourceExcerpt && (
              <span className="block text-sm text-slate">From: &ldquo;{l.sourceExcerpt}&rdquo;</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const RATING_ITEMS: { key: keyof ResearchRatings; text: string; low: string; high: string }[] = [
  { key: "perceivedControl", text: "I felt in control of what the final output says.", low: "Strongly disagree", high: "Strongly agree" },
  { key: "appropriateTrust", text: "I could tell which parts of the AI output to rely on and which to check.", low: "Strongly disagree", high: "Strongly agree" },
  { key: "easeOfVerification", text: "It was easy to check the AI output against what was said.", low: "Strongly disagree", high: "Strongly agree" },
  { key: "confidenceInOutput", text: "I am confident the final output reflects what was said.", low: "Strongly disagree", high: "Strongly agree" },
  { key: "mentalEffort", text: "How much mental effort did the review take?", low: "Very low", high: "Very high" },
];

export function NarrativeScreen() {
  const { state, dispatch, requestDelete } = useSession();
  const [copied, setCopied] = useState("");
  const [showSources, setShowSources] = useState(false);
  const baselineOnly = state.research.enabled && state.research.condition === "baseline";
  const narrative = useMemo(() => (state.analysis ? buildNarrative(state.analysis.claims) : null), [state.analysis]);
  const origin = baselineOnly ? state.summary?.origin : state.analysis?.origin;

  const title = baselineOnly ? "User-reviewed AI summary" : NARRATIVE_TITLE;
  const plainText = baselineOnly
    ? `${title}\nPrototype output. Not an official report, complaint, verified statement or legal document.\n\n${state.summaryText}`
    : narrative
      ? narrativeToText(narrative)
      : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied("Copied to clipboard.");
    } catch {
      setCopied("Copying was blocked by the browser. Select the text and copy it manually.");
    }
  };

  const jsonData = baselineOnly
    ? { label: title, origin, generatedAt: state.narrativeGeneratedAt, text: state.summaryText }
    : narrative
      ? narrativeToJSON(narrative, { origin: origin ?? "unknown", generatedAt: state.narrativeGeneratedAt ?? "" })
      : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <article aria-labelledby="narrative-title" className="print-plain rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h1 id="narrative-title" className="text-[30px] font-bold tracking-[-0.02em]">
          {title}
        </h1>
        <p className="mt-2 text-[15px] text-slate">
          Prototype output assembled only from what you approved. It is not an official report, police complaint, verified
          statement or legal document, and Bol has not checked whether any of it happened.
        </p>
        {origin === "fixture" && <FixtureLabel className="mt-3" />}
        {state.narrativeGeneratedAt && (
          <p className="mt-2 text-sm text-muted">Assembled {new Date(state.narrativeGeneratedAt).toLocaleString("en-GB")}</p>
        )}

        {baselineOnly ? (
          <p className="mt-6 text-[17px] leading-[1.7]">{state.summaryText}</p>
        ) : narrative ? (
          <div className="mt-6 space-y-6">
            {narrative.counts.included === 0 && (
              <p className="rounded-md bg-mist p-3 text-[15px]">
                No claims have been accepted or edited yet, so the narrative is empty. Return to review to choose what to keep.
              </p>
            )}
            <Section title="Confirmed by you" description="Claims you accepted or put in your own words." lines={narrative.confirmed} tone="confirmed" showSource={showSources} />
            <Section title="Retained as approximate" description="Kept with the approximate wording from your account." lines={narrative.approximate} tone="approximate" showSource={showSources} />
            <Section title="Kept without verified support" description="You chose to keep these although Bol found no support in your words." lines={narrative.keptWithoutSupport} tone="kept" showSource={showSources} />
            <Section title="Still uncertain" description="You marked these as uncertain. They are listed, not stated as fact." lines={narrative.uncertain} tone="uncertain" showSource={showSources} />
            <Section title="Excluded" description="Not included in the narrative." lines={narrative.excluded} tone="excluded" />
          </div>
        ) : null}
      </article>

      <aside className="no-print space-y-4">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Keep or discard</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Button onClick={() => window.print()}>Print or save as PDF</Button>
            <Button disabled={!jsonData} onClick={() => jsonData && download("bol-narrative.json", jsonData)}>
              Download JSON
            </Button>
            <Button onClick={copy}>Copy text</Button>
            {!baselineOnly && (
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[#2f5585]" checked={showSources} onChange={(e) => setShowSources(e.target.checked)} />
                Show source words
              </label>
            )}
            <p aria-live="polite" className="min-h-5 text-sm text-slate">
              {copied}
            </p>
            <Button variant="quiet" onClick={() => dispatch({ type: "goto", step: "compare" })}>
              Return to review
            </Button>
            <Button variant="danger" onClick={requestDelete}>
              Delete session
            </Button>
          </div>
        </div>

        {state.research.enabled && <ResearchPanel />}
      </aside>
    </div>
  );
}

function ResearchPanel() {
  const { state, dispatch } = useSession();
  const r = state.research;
  const complete = RATING_ITEMS.every((i) => r.ratings[i.key] !== null);
  return (
    <section aria-labelledby="ratings-title" className="rounded-xl border border-lav/40 bg-lav-soft/50 p-5">
      <h2 id="ratings-title" className="font-semibold">
        Study ratings
      </h2>
      <p className="mt-1 text-sm text-slate">Prototype measures, 1 to 7. Not a validated instrument. Skip any you prefer not to answer.</p>
      <div className="mt-3 space-y-4">
        {RATING_ITEMS.map((item) => (
          <fieldset key={item.key}>
            <legend className="text-[14px] font-semibold">{item.text}</legend>
            <div className="mt-1 flex items-center justify-between gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((v) => (
                <label key={v} className="flex flex-col items-center text-[13px]">
                  <input
                    type="radio"
                    name={item.key}
                    className="h-4 w-4 accent-[#5b4c9e]"
                    checked={r.ratings[item.key] === v}
                    onChange={() => dispatch({ type: "rate", key: item.key, value: v })}
                    aria-label={`${v}${v === 1 ? `, ${item.low}` : v === 7 ? `, ${item.high}` : ""}`}
                  />
                  {v}
                </label>
              ))}
            </div>
            <div className="flex justify-between text-[12px] text-slate">
              <span>{item.low}</span>
              <span>{item.high}</span>
            </div>
          </fieldset>
        ))}
      </div>
      <Button
        className="mt-4 w-full"
        onClick={() => {
          dispatch({ type: "research", patch: { submitted: true } });
          download(`bol-metrics-${r.participantCode || "session"}.json`, researchExport(state));
        }}
      >
        Export de-identified metrics
      </Button>
      {!complete && <p className="mt-2 text-[13px] text-slate">Some ratings are blank; they will export as empty.</p>}
      <p className="mt-2 text-[13px] text-slate">The export contains counts, timings and ratings only. No narrative text.</p>
    </section>
  );
}
