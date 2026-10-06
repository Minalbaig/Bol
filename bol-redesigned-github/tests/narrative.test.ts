import { describe, expect, it } from "vitest";
import { fixtureAnalysis, getScenario } from "@/lib/fixtures";
import { buildNarrative, narrativeToJSON, narrativeToText } from "@/lib/narrative";
import { applyClaimAction } from "@/lib/session";
import type { AnalyzedClaim } from "@/lib/schema";

function reviewed(): AnalyzedClaim[] {
  const claims = fixtureAnalysis(getScenario("bus-stop")!).claims;
  return claims.map((c) => {
    if (c.id === "c3") return c; // unsupported, left unreviewed
    if (c.id === "c8") return applyClaimAction(c, { type: "reject" });
    if (c.id === "c11") return applyClaimAction(c, { type: "uncertain" });
    if (c.id === "c7") return applyClaimAction(c, { type: "edit", text: "I moved a little away from him." });
    return applyClaimAction(c, { type: "accept" });
  });
}

describe("final narrative", () => {
  it("contains only approved claims", () => {
    const n = buildNarrative(reviewed());
    const included = [...n.confirmed, ...n.approximate, ...n.keptWithoutSupport].map((l) => l.id);
    expect(included).not.toContain("c3");
    expect(included).not.toContain("c8");
    expect(included).not.toContain("c11");
    expect(n.uncertain.map((l) => l.id)).toEqual(["c11"]);
    expect(n.excluded.map((l) => l.id).sort()).toEqual(["c3", "c8"]);
  });

  it("keeps unsupported claims out unless explicitly kept, and labels them when kept", () => {
    const claims = reviewed();
    expect(buildNarrative(claims).excluded.find((e) => e.id === "c3")!.reason).toBe("Unsupported and not reviewed");
    const kept = claims.map((c) => (c.id === "c3" ? applyClaimAction(c, { type: "accept" }) : c));
    const n = buildNarrative(kept);
    expect(n.keptWithoutSupport.map((l) => l.id)).toEqual(["c3"]);
    expect(n.confirmed.map((l) => l.id)).not.toContain("c3");
  });

  it("uses the person's edited wording", () => {
    const n = buildNarrative(reviewed());
    expect(n.confirmed.find((l) => l.id === "c7")!.text).toBe("I moved a little away from him.");
  });

  it("retains approximate language for approximate claims", () => {
    const n = buildNarrative(reviewed());
    const c1 = n.approximate.find((l) => l.id === "c1")!;
    expect(c1.text).toContain("around 6");
    const text = narrativeToText(n);
    expect(text).not.toMatch(/6:00|6 ?pm/i);
    expect(text).not.toMatch(/terrified|harass|victim/i);
  });

  it("is never labelled as an official document", () => {
    const n = buildNarrative(reviewed());
    expect(n.title).toBe("User-reviewed AI-assisted narrative");
    const json = narrativeToJSON(n, { origin: "fixture", generatedAt: "2026-10-06T00:00:00Z" });
    expect(json.disclaimer).toMatch(/Not an official report/);
  });

  it("excludes claims that were never reviewed", () => {
    const claims = fixtureAnalysis(getScenario("checkout")!).claims;
    const n = buildNarrative(claims);
    expect(n.counts.included).toBe(0);
    expect(n.excluded).toHaveLength(claims.length);
  });
});
