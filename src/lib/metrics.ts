import type { AnalysisResult, SummaryAuditResult } from "./schema";
import type { SessionState } from "./session";

/** Real measurements of this session only. No accuracy figures are computed or implied. */
export interface Evaluation {
  total: number;
  direct: number;
  approximate: number;
  unsupportedBlocked: number;
  unknown: number;
  accepted: number;
  edited: number;
  rejected: number;
  uncertain: number;
  pending: number;
  validated: number;
  validationRate: number | null;
  matchKinds: { exact: number; normalized: number; fuzzy: number; not_found: number };
  guardFlags: number;
  verifierDisagreements: number;
  extractionMs: number | null;
  verificationMs: number | null;
  origin: "live" | "fixture";
}

export function evaluate(a: AnalysisResult): Evaluation {
  const c = a.claims;
  const count = (f: (x: (typeof c)[number]) => boolean) => c.filter(f).length;
  const matchKinds = { exact: 0, normalized: 0, fuzzy: 0, not_found: 0 };
  for (const x of c) matchKinds[x.match.status]++;
  const validated = c.length - matchKinds.not_found;
  return {
    total: c.length,
    direct: count((x) => x.evidenceType === "direct"),
    approximate: count((x) => x.evidenceType === "approximate"),
    unsupportedBlocked: count((x) => x.evidenceType === "unsupported" && x.userStatus !== "accepted" && x.userStatus !== "edited"),
    unknown: count((x) => x.evidenceType === "unknown"),
    accepted: count((x) => x.userStatus === "accepted"),
    edited: count((x) => x.userStatus === "edited"),
    rejected: count((x) => x.userStatus === "rejected"),
    uncertain: count((x) => x.userStatus === "uncertain"),
    pending: count((x) => x.userStatus === "pending"),
    validated,
    validationRate: c.length ? validated / c.length : null,
    matchKinds,
    guardFlags: c.reduce((n, x) => n + x.guardFlags.length, 0),
    verifierDisagreements: count((x) => x.verifierVerdict !== null && x.verifierVerdict !== x.extractorEvidenceType),
    extractionMs: a.timings.extractionMs,
    verificationMs: a.timings.verificationMs,
    origin: a.origin,
  };
}

/** De-identified research export. Contains counts and ratings only, never narrative text. */
export function researchExport(s: SessionState) {
  const r = s.research;
  const ev = s.analysis ? evaluate(s.analysis) : null;
  const audit: SummaryAuditResult | null = s.audit;
  return {
    instrumentNote:
      "Prototype measures. Not a validated psychological instrument. Contains no narrative content.",
    participantCode: r.participantCode || null,
    condition: r.condition,
    dataOrigin: s.analysis?.origin ?? s.summary?.origin ?? null,
    scenario: s.scenarioId,
    inputMethod: s.inputSource,
    reviewTimeSeconds:
      r.reviewStartedAt !== null && r.reviewEndedAt !== null ? Math.round((r.reviewEndedAt - r.reviewStartedAt) / 1000) : null,
    claims: ev
      ? {
          total: ev.total,
          accepted: ev.accepted,
          edited: ev.edited,
          rejected: ev.rejected,
          uncertain: ev.uncertain,
          notReviewed: ev.pending,
          flaggedUnsupported: s.analysis?.claims.filter((c) => c.evidenceType === "unsupported").length ?? 0,
          flaggedUnsupportedRejectedOrLeftOut:
            s.analysis?.claims.filter(
              (c) => c.evidenceType === "unsupported" && (c.userStatus === "rejected" || c.userStatus === "pending" || c.userStatus === "uncertain"),
            ).length ?? 0,
        }
      : null,
    evidenceOpened: r.evidenceOpens,
    baseline: {
      summaryEdits: r.summaryEdits,
      verifierRunOnSummary: r.summaryAuditRun,
      statementsFlaggedUnsupported: audit ? audit.statements.filter((x) => x.verdict === "unsupported").length : null,
      statementsTotal: audit ? audit.statements.length : null,
    },
    ratings: r.ratings,
    ratingScale: "1 (low) to 7 (high)",
  };
}
