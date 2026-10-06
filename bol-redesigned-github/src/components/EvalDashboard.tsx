"use client";

import type { AnalysisResult } from "@/lib/schema";
import { evaluate } from "@/lib/metrics";
import type { ServiceStatus } from "./BolApp";

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-1.5 last:border-0">
      <dt className="text-slate">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

const ms = (v: number | null, origin: string) =>
  v === null ? (origin === "fixture" ? "Not measured (precomputed)" : "–") : `${(v / 1000).toFixed(2)} s`;

export function EvalDashboard({ analysis, status }: { analysis: AnalysisResult; status: ServiceStatus | null }) {
  const e = evaluate(analysis);
  return (
    <section aria-labelledby="eval-title" className="rounded-xl border border-line bg-mist p-5 text-[14px]">
      <h2 id="eval-title" className="text-[15px] font-semibold text-ink">
        Technical details: this session only
      </h2>
      <p className="mt-1 text-slate">
        Counts from this run of the pipeline. They are not accuracy figures and the system has not been scientifically validated.
      </p>
      <div className="mt-3 grid gap-x-8 md:grid-cols-2">
        <dl>
          <Row label="Total extracted claims" value={e.total} />
          <Row label="Direct" value={e.direct} />
          <Row label="Approximate" value={e.approximate} />
          <Row label="Unsupported, blocked from narrative" value={e.unsupportedBlocked} />
          <Row label="Cannot determine" value={e.unknown} />
          <Row label="Deterministic guard flags" value={e.guardFlags} />
          <Row label="Verifier disagreed with extractor" value={e.verifierDisagreements} />
        </dl>
        <dl>
          <Row label="Accepted" value={e.accepted} />
          <Row label="Edited" value={e.edited} />
          <Row label="Rejected" value={e.rejected} />
          <Row label="Marked uncertain" value={e.uncertain} />
          <Row
            label="Source validation success"
            value={e.validationRate === null ? "–" : `${e.validated} of ${e.total} (${Math.round(e.validationRate * 100)}%)`}
          />
          <Row
            label="Match types (exact / normalized / fuzzy / not found)"
            value={`${e.matchKinds.exact} / ${e.matchKinds.normalized} / ${e.matchKinds.fuzzy} / ${e.matchKinds.not_found}`}
          />
          <Row label="Extraction time" value={ms(e.extractionMs, e.origin)} />
          <Row label="Verification time" value={ms(e.verificationMs, e.origin)} />
        </dl>
      </div>
      <p className="mt-3 text-slate">
        Data origin: {e.origin === "live" ? "live API responses" : "precomputed demonstration output (validation and guards ran live in the browser)"}.
        {status && e.origin === "live" && (
          <> Models: extraction {status.models.extraction}, verifier {status.models.verifier}.</>
        )}
      </p>
    </section>
  );
}
