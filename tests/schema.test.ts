import { describe, expect, it } from "vitest";
import { ClaimSchema, ExtractionOutputSchema, VerificationOutputSchema } from "@/lib/schema";
import { SCENARIOS } from "@/lib/fixtures";

const valid = {
  id: "c1",
  claim: "The person was at a bus stop.",
  category: "place",
  sourceExcerpt: "main bus stop par thi",
  evidenceType: "direct",
  confidence: 0.9,
  uncertaintyMarkers: [],
  supportExplanation: "Stated directly.",
  userStatus: "pending",
  userEditedClaim: null,
};

describe("Zod schema validation", () => {
  it("accepts a claim with every required field", () => {
    expect(ClaimSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a claim missing required fields", () => {
    const { sourceExcerpt: _omit, ...rest } = valid;
    void _omit;
    expect(ClaimSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects evidence types and statuses outside the allowed sets", () => {
    expect(ClaimSchema.safeParse({ ...valid, evidenceType: "probable" }).success).toBe(false);
    expect(ClaimSchema.safeParse({ ...valid, userStatus: "approved" }).success).toBe(false);
  });

  it("rejects confidence outside 0 to 1", () => {
    expect(ClaimSchema.safeParse({ ...valid, confidence: 1.4 }).success).toBe(false);
  });

  it("rejects malformed model output so it can fail safely", () => {
    expect(ExtractionOutputSchema.safeParse({ claims: "not an array" }).success).toBe(false);
    expect(ExtractionOutputSchema.safeParse({ claims: [], notInferred: [], optionalQuestions: [] }).success).toBe(false);
    expect(VerificationOutputSchema.safeParse({ verdicts: [{ id: "c1", verdict: "true" }] }).success).toBe(false);
  });

  it("validates every fixture against the same schemas the live pipeline uses", () => {
    for (const s of SCENARIOS) {
      expect(ExtractionOutputSchema.safeParse(s.extraction).success).toBe(true);
      expect(VerificationOutputSchema.safeParse(s.verification).success).toBe(true);
    }
  });
});
