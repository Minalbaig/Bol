import { describe, expect, it } from "vitest";
import { checkStatement, deriveNotAssumed, isNeutralQuestion, mostConservative } from "@/lib/guards";
import { assembleClaims } from "@/lib/pipeline";
import { buildNarrative, narrativeToText } from "@/lib/narrative";
import { applyClaimAction } from "@/lib/session";
import { claim, extraction, TRANSCRIPT_A } from "./helpers";

describe("approximate time preservation", () => {
  it('"around 6" never automatically becomes "6:00 PM"', () => {
    const flags = checkStatement("The event happened at 6:00 PM.", "Kal around 6 baje");
    expect(flags.some((f) => f.kind === "exactness")).toBe(true);

    // Even if both the extractor and the verifier call it direct, Bol blocks it.
    const [c] = assembleClaims(
      TRANSCRIPT_A,
      extraction([claim({ id: "c1", claim: "The event happened at 6:00 PM.", sourceExcerpt: "Kal around 6 baje" })]),
      { verdicts: [{ id: "c1", verdict: "direct", explanation: "ok" }] },
    );
    expect(c!.evidenceType).toBe("unsupported");

    // And it does not reach the narrative unless the person explicitly keeps it.
    const text = narrativeToText(buildNarrative([c!]));
    expect(text).not.toMatch(/Confirmed by the person[\s\S]*6:00 PM/);
    expect(buildNarrative([c!]).confirmed).toHaveLength(0);
  });

  it("flags dropping the hedge from a hedged number", () => {
    const flags = checkStatement("It happened at 6 o'clock.", "Kal around 6 baje");
    expect(flags.map((f) => f.kind)).toContain("uncertainty_removed");
  });

  it("keeps a claim that preserves the approximation", () => {
    expect(checkStatement("This happened 'kal', at around 6 o'clock.", "Kal around 6 baje")).toEqual([]);
  });

  it("flags a number of seconds invented from 'kuch seconds'", () => {
    expect(checkStatement("The participant paused for 5 seconds.", "Main kuch seconds ruk gayi").map((f) => f.kind)).toContain(
      "exactness",
    );
  });
});

describe("unsupported emotion inference", () => {
  it('"I moved away" never automatically becomes "I was terrified and escaped"', () => {
    const flags = checkStatement("I was terrified and escaped.", "thora door chali gayi");
    const kinds = flags.map((f) => f.kind);
    expect(kinds).toContain("emotion");
    expect(kinds).toContain("escalation");

    const [c] = assembleClaims(
      TRANSCRIPT_A,
      extraction([claim({ id: "c7", claim: "I was terrified and escaped.", sourceExcerpt: "thora door chali gayi" })]),
      { verdicts: [{ id: "c7", verdict: "direct", explanation: "ok" }] },
    );
    expect(c!.evidenceType).toBe("unsupported");
    expect(buildNarrative([c!]).counts.included).toBe(0);
  });

  it("does not flag an emotion the person stated in their own words", () => {
    expect(checkStatement("The checkout was a little confusing.", "Checkout thora confusing tha")).toEqual([]);
  });
});

describe("unsupported intent and legal inference", () => {
  it("flags intent that the source does not state", () => {
    expect(checkStatement("He intended to harm her.", "Phir woh paas aya aur bola ke apna number do").map((f) => f.kind)).toContain(
      "intent",
    );
  });

  it("flags legal classification", () => {
    expect(checkStatement("This was harassment.", "Woh dobara paas aya").map((f) => f.kind)).toContain("legal");
    expect(checkStatement("The victim has evidence.", "Mere paas bus ticket hai").map((f) => f.kind)).toContain("legal");
  });
});

describe("conservative merging", () => {
  it("always takes the most cautious judgement", () => {
    expect(mostConservative("direct", "approximate")).toBe("approximate");
    expect(mostConservative("approximate", "unsupported", "direct")).toBe("unsupported");
    expect(mostConservative("direct", null, undefined)).toBe("direct");
  });

  it("marks a claim with an invented excerpt as unsupported", () => {
    const [c] = assembleClaims(
      TRANSCRIPT_A,
      extraction([claim({ id: "x", claim: "He followed her home.", sourceExcerpt: "woh ghar tak peeche aya" })]),
      null,
    );
    expect(c!.match.status).toBe("not_found");
    expect(c!.evidenceType).toBe("unsupported");
    expect(c!.confidence).toBeLessThanOrEqual(0.2);
  });

  it("treats a missing verifier verdict as unknown, not as support", () => {
    const [c] = assembleClaims(
      TRANSCRIPT_A,
      extraction([claim({ id: "c2", claim: "The person was at a bus stop.", sourceExcerpt: "main bus stop par thi" })]),
      { verdicts: [] },
    );
    expect(c!.evidenceType).toBe("unknown");
  });
});

describe("what Bol did not assume", () => {
  it("only lists items relevant to the narrative", () => {
    const a = deriveNotAssumed(TRANSCRIPT_A).map((i) => i.kind);
    expect(a).toContain("exact_time");
    expect(a).toContain("emotion");
    const b = deriveNotAssumed("I felt scared when the lift stopped.").map((i) => i.kind);
    expect(b).not.toContain("emotion");
    expect(b).not.toContain("exact_time");
  });

  it("filters leading optional questions", () => {
    expect(isNeutralQuestion("If you want, you can add where this happened.")).toBe(true);
    expect(isNeutralQuestion("Were you scared when he came back?")).toBe(false);
    expect(isNeutralQuestion("Why didn't you report it?")).toBe(false);
  });
});

describe("user rejection", () => {
  it("removes a rejected claim from the narrative", () => {
    const [c] = assembleClaims(
      TRANSCRIPT_A,
      extraction([claim({ id: "c6", claim: "The person refused.", sourceExcerpt: "Maine mana kiya" })]),
      { verdicts: [{ id: "c6", verdict: "direct", explanation: "ok" }] },
    );
    const accepted = applyClaimAction(c!, { type: "accept" });
    expect(buildNarrative([accepted]).confirmed).toHaveLength(1);
    const rejected = applyClaimAction(accepted, { type: "reject" });
    const n = buildNarrative([rejected]);
    expect(n.confirmed).toHaveLength(0);
    expect(n.excluded[0]!.reason).toBe("Rejected by the person");
  });
});
