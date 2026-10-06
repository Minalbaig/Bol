import type { AnalyzedClaim } from "./schema";

/**
 * Final narrative assembly.
 *
 * Deliberate design decision: this step does not call a model. The narrative
 * is composed only from claims the person approved, in the wording they
 * approved, so no new content, emotion or certainty can be introduced at the
 * last step. Approximate claims keep their approximate wording.
 */

export interface NarrativeLine {
  id: string;
  text: string;
  sourceExcerpt: string;
  note?: string;
}

export interface Narrative {
  title: string;
  confirmed: NarrativeLine[];
  approximate: NarrativeLine[];
  keptWithoutSupport: NarrativeLine[];
  uncertain: NarrativeLine[];
  excluded: (NarrativeLine & { reason: string })[];
  counts: { included: number; uncertain: number; excluded: number };
}

export const NARRATIVE_TITLE = "User-reviewed AI-assisted narrative";

export function displayText(c: AnalyzedClaim): string {
  return (c.userStatus === "edited" && c.userEditedClaim ? c.userEditedClaim : c.claim).trim();
}

function asSentence(t: string): string {
  const s = t.trim();
  return /[.!?…"')]$/.test(s) ? s : `${s}.`;
}

function order(a: AnalyzedClaim, b: AnalyzedClaim): number {
  return (a.match.start ?? Number.MAX_SAFE_INTEGER) - (b.match.start ?? Number.MAX_SAFE_INTEGER);
}

export function buildNarrative(claims: AnalyzedClaim[]): Narrative {
  const n: Narrative = {
    title: NARRATIVE_TITLE,
    confirmed: [],
    approximate: [],
    keptWithoutSupport: [],
    uncertain: [],
    excluded: [],
    counts: { included: 0, uncertain: 0, excluded: 0 },
  };

  for (const c of [...claims].sort(order)) {
    const line: NarrativeLine = { id: c.id, text: asSentence(displayText(c)), sourceExcerpt: c.match.matchedText ?? "" };
    switch (c.userStatus) {
      case "edited":
        n.confirmed.push({ ...line, note: "Edited by the person" });
        break;
      case "accepted":
        if (c.evidenceType === "direct") n.confirmed.push(line);
        else if (c.evidenceType === "approximate") n.approximate.push(line);
        else n.keptWithoutSupport.push({ ...line, note: "Kept by the person; no verified source support" });
        break;
      case "uncertain":
        n.uncertain.push(line);
        break;
      case "rejected":
        n.excluded.push({ ...line, reason: "Rejected by the person" });
        break;
      case "pending":
        n.excluded.push({
          ...line,
          reason: c.evidenceType === "unsupported" ? "Unsupported and not reviewed" : "Not reviewed",
        });
        break;
    }
  }
  n.counts = {
    included: n.confirmed.length + n.approximate.length + n.keptWithoutSupport.length,
    uncertain: n.uncertain.length,
    excluded: n.excluded.length,
  };
  return n;
}

export function narrativeToText(n: Narrative): string {
  const block = (heading: string, lines: NarrativeLine[]) =>
    lines.length ? [`${heading}`, ...lines.map((l) => `- ${l.text}${l.note ? ` (${l.note})` : ""}`), ""] : [];
  return [
    n.title,
    "Prototype output. Not an official report, complaint, verified statement or legal document.",
    "",
    ...block("Confirmed by the person", n.confirmed),
    ...block("Retained as approximate", n.approximate),
    ...block("Kept without verified source support", n.keptWithoutSupport),
    ...block("Still uncertain", n.uncertain),
    ...block(
      "Excluded",
      n.excluded.map((e) => ({ ...e, note: e.reason })),
    ),
  ]
    .join("\n")
    .trim();
}

export function narrativeToJSON(n: Narrative, meta: { origin: string; generatedAt: string }) {
  return {
    label: n.title,
    disclaimer: "Prototype output. Not an official report, complaint, verified statement or legal document.",
    origin: meta.origin,
    generatedAt: meta.generatedAt,
    sections: {
      confirmedByPerson: n.confirmed,
      retainedAsApproximate: n.approximate,
      keptWithoutVerifiedSupport: n.keptWithoutSupport,
      stillUncertain: n.uncertain,
      excluded: n.excluded,
    },
  };
}
