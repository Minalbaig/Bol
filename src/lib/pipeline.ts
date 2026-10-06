import type {
  AnalyzedClaim,
  AuditedStatement,
  EvidenceType,
  ExtractionOutput,
  NotInferred,
  SummaryAuditOutput,
  VerificationOutput,
} from "./schema";
import { checkStatement, deriveNotAssumed, isNeutralQuestion, mergeNotAssumed, mostConservative } from "./guards";
import { isValidated, validateSource } from "./sourceValidation";

const VALIDATION_EXPLANATION =
  "The cited words could not be found in the confirmed transcript, so this claim has no verified source.";

/**
 * Combine extractor output, deterministic validation, deterministic guards and
 * the independent verifier into the claims shown to the person.
 * The most conservative judgement always wins.
 */
export function assembleClaims(
  transcript: string,
  extraction: ExtractionOutput,
  verification: VerificationOutput | null,
): AnalyzedClaim[] {
  const seen = new Set<string>();
  return extraction.claims.map((c, index) => {
    let id = c.id.trim() || `c${index + 1}`;
    if (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);

    const match = validateSource(transcript, c.sourceExcerpt);
    const citedText = match.matchedText ?? "";
    const guardFlags = checkStatement(c.claim, citedText);
    const verdict = verification?.verdicts.find((v) => v.id === c.id) ?? null;

    const finalType: EvidenceType = mostConservative(
      c.evidenceType,
      verdict?.verdict ?? (verification ? "unknown" : null),
      isValidated(match) ? null : "unsupported",
      guardFlags.length > 0 ? "unsupported" : null,
    );

    let supportExplanation = c.supportExplanation;
    if (!isValidated(match)) supportExplanation = VALIDATION_EXPLANATION;
    else if (guardFlags.length > 0) supportExplanation = guardFlags[0]?.message ?? supportExplanation;
    else if (verdict && verdict.verdict !== c.evidenceType) supportExplanation = verdict.explanation;

    return {
      ...c,
      id,
      evidenceType: finalType,
      supportExplanation,
      // Never report high confidence on a claim the checks downgraded.
      confidence: finalType === "unsupported" ? Math.min(c.confidence, 0.2) : c.confidence,
      userStatus: "pending",
      userEditedClaim: null,
      originalClaim: c.claim,
      extractorEvidenceType: c.evidenceType,
      verifierVerdict: verdict?.verdict ?? null,
      verifierExplanation: verdict?.explanation ?? null,
      match,
      guardFlags,
    };
  });
}

export function assembleNotAssumed(transcript: string, proposed: NotInferred[]): NotInferred[] {
  return mergeNotAssumed(deriveNotAssumed(transcript), proposed, transcript);
}

export function filterQuestions(questions: string[]): string[] {
  return questions.filter(isNeutralQuestion).slice(0, 2);
}

/** Split a summary into sentence-level statements for auditing. */
export function splitStatements(summary: string): { id: string; text: string }[] {
  const parts = summary
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  return parts.map((text, i) => ({ id: `s${i + 1}`, text }));
}

export function assembleAudit(
  transcript: string,
  statements: { id: string; text: string }[],
  audit: SummaryAuditOutput,
): AuditedStatement[] {
  return statements.map((st) => {
    const a = audit.statements.find((x) => x.id === st.id);
    const excerpt = a?.sourceExcerpt ?? "";
    const match = validateSource(transcript, excerpt);
    const guardFlags = checkStatement(st.text, match.matchedText ?? "");
    const verdict = mostConservative(
      a?.verdict ?? "unknown",
      isValidated(match) ? null : "unsupported",
      guardFlags.length > 0 ? "unsupported" : null,
    );
    let explanation = a?.explanation ?? "The verifier did not return a judgement for this statement.";
    if (!isValidated(match)) {
      explanation = excerpt
        ? "The words cited for this statement could not be found in the transcript."
        : (a?.explanation ?? "No supporting words were found in the transcript for this statement.");
    }
    else if (guardFlags.length > 0) explanation = guardFlags[0]?.message ?? explanation;
    return { id: st.id, text: st.text, sourceExcerpt: excerpt, verdict, explanation, match, guardFlags };
  });
}
