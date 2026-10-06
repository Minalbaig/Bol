import { z } from "zod";

export const EVIDENCE_TYPES = ["direct", "approximate", "unsupported", "unknown"] as const;
export const USER_STATUSES = ["pending", "accepted", "edited", "rejected", "uncertain"] as const;
export const CLAIM_CATEGORIES = [
  "time",
  "place",
  "action",
  "speech",
  "person",
  "object",
  "sequence",
  "memory",
  "opinion",
  "other",
] as const;
export const NOT_INFERRED_KINDS = [
  "emotion",
  "intent",
  "exact_time",
  "legal",
  "physical",
  "identity",
  "diagnosis",
  "severity",
  "other",
] as const;

export const EvidenceTypeSchema = z.enum(EVIDENCE_TYPES);
export const UserStatusSchema = z.enum(USER_STATUSES);
export const CategorySchema = z.enum(CLAIM_CATEGORIES);

export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type ClaimCategory = z.infer<typeof CategorySchema>;

/** The shape required by the brief for every claim. */
export const ClaimSchema = z.object({
  id: z.string().min(1).max(40),
  claim: z.string().min(1).max(600),
  category: CategorySchema,
  sourceExcerpt: z.string().max(800),
  evidenceType: EvidenceTypeSchema,
  confidence: z.number().min(0).max(1),
  uncertaintyMarkers: z.array(z.string().max(80)).max(12),
  supportExplanation: z.string().min(1).max(400),
  userStatus: UserStatusSchema,
  userEditedClaim: z.string().max(600).nullable(),
});
export type Claim = z.infer<typeof ClaimSchema>;

/** What the extraction model returns (before Bol adds user fields). */
export const ExtractedClaimSchema = ClaimSchema.omit({ userStatus: true, userEditedClaim: true });
export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;

export const NotInferredSchema = z.object({
  kind: z.enum(NOT_INFERRED_KINDS),
  note: z.string().min(1).max(300),
  relatedExcerpt: z.string().max(400).optional().default(""),
});
export type NotInferred = z.infer<typeof NotInferredSchema>;

export const ExtractionOutputSchema = z.object({
  claims: z.array(ExtractedClaimSchema).min(1).max(40),
  notInferred: z.array(NotInferredSchema).max(10),
  optionalQuestions: z.array(z.string().min(1).max(200)).max(3),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

export const VerdictSchema = z.object({
  id: z.string().min(1),
  verdict: EvidenceTypeSchema,
  explanation: z.string().min(1).max(400),
});
export const VerificationOutputSchema = z.object({ verdicts: z.array(VerdictSchema) });
export type VerificationOutput = z.infer<typeof VerificationOutputSchema>;

export const SummaryAuditOutputSchema = z.object({
  statements: z.array(
    z.object({
      id: z.string().min(1),
      sourceExcerpt: z.string().max(800),
      verdict: EvidenceTypeSchema,
      explanation: z.string().min(1).max(400),
    }),
  ),
});
export type SummaryAuditOutput = z.infer<typeof SummaryAuditOutputSchema>;

export const SummaryOutputSchema = z.object({ summary: z.string().min(1).max(3000) });

/* ---------- Results returned to the client ---------- */

export type MatchStatus = "exact" | "normalized" | "fuzzy" | "not_found";

export interface SourceMatch {
  status: MatchStatus;
  start: number | null;
  end: number | null;
  /** Slice of the original transcript, untouched. */
  matchedText: string | null;
  similarity: number;
}

export type GuardKind = "emotion" | "intent" | "legal" | "exactness" | "escalation" | "uncertainty_removed";

export interface GuardFlag {
  kind: GuardKind;
  term: string;
  message: string;
}

export interface AnalyzedClaim extends Claim {
  /** The AI wording before any user edit, so it can be restored. */
  originalClaim: string;
  extractorEvidenceType: EvidenceType;
  verifierVerdict: EvidenceType | null;
  verifierExplanation: string | null;
  match: SourceMatch;
  guardFlags: GuardFlag[];
}

export interface AuditedStatement {
  id: string;
  text: string;
  sourceExcerpt: string;
  verdict: EvidenceType;
  explanation: string;
  match: SourceMatch;
  guardFlags: GuardFlag[];
}

export interface AnalysisResult {
  claims: AnalyzedClaim[];
  notInferred: NotInferred[];
  optionalQuestions: string[];
  timings: { extractionMs: number | null; verificationMs: number | null };
  origin: "live" | "fixture";
}

export interface SummaryResult {
  summary: string;
  origin: "live" | "fixture";
  ms: number | null;
}

export interface SummaryAuditResult {
  statements: AuditedStatement[];
  origin: "live" | "fixture";
  ms: number | null;
}

/** Shape of every API error the client ever sees. Never contains request content. */
export interface SafeError {
  error: { code: string; message: string; retryable: boolean };
}
