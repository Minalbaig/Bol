import { describe, expect, it } from "vitest";
import { fixtureAnalysis, fixtureSummary, getScenario } from "@/lib/fixtures";
import { applyClaimAction, initialState, reducer, type SessionState } from "@/lib/session";
import { researchExport } from "@/lib/metrics";

function populated(): SessionState {
  const sc = getScenario("bus-stop")!;
  let s = initialState("fixture");
  s = reducer(s, { type: "research", patch: { enabled: true, consented: true, participantCode: "P01" } });
  s = reducer(s, { type: "loadScenario", id: "bus-stop", confirmed: true });
  s = reducer(s, { type: "setSummary", result: fixtureSummary(sc) });
  s = reducer(s, { type: "setAnalysis", result: fixtureAnalysis(sc) });
  s = reducer(s, { type: "claim", id: "c2", action: { type: "accept" } });
  s = reducer(s, { type: "researchEvidenceOpened" });
  s = reducer(s, { type: "rate", key: "perceivedControl", value: 6 });
  return s;
}

describe("session deletion", () => {
  it("clears transcript, outputs, decisions and research measures", () => {
    const s = reducer({ ...populated(), showTechnical: true }, { type: "deleteSession" });
    expect(s.step).toBe("intro");
    expect(s.transcript).toBe("");
    expect(s.history).toEqual([]);
    expect(s.summary).toBeNull();
    expect(s.analysis).toBeNull();
    expect(s.audit).toBeNull();
    expect(s.consented).toBe(false);
    expect(s.research.enabled).toBe(false);
    expect(s.research.evidenceOpens).toBe(0);
    expect(s.research.ratings.perceivedControl).toBeNull();
    // presenter settings survive
    expect(s.mode).toBe("fixture");
    expect(s.showTechnical).toBe(true);
  });
});

describe("demo fixture loading", () => {
  it("loads a confirmed transcript straight to the comparison step", () => {
    const s = reducer(initialState(), { type: "loadScenario", id: "checkout", confirmed: true });
    expect(s.step).toBe("compare");
    expect(s.transcriptConfirmed).toBe(true);
    expect(s.transcript).toBe(getScenario("checkout")!.transcript);
  });

  it("loads an unconfirmed transcript to the review step", () => {
    const s = reducer(initialState(), { type: "loadScenario", id: "bus-stop", confirmed: false });
    expect(s.step).toBe("transcript");
    expect(s.transcriptConfirmed).toBe(false);
  });

  it("produces validated, labelled fixture output", () => {
    const a = fixtureAnalysis(getScenario("bus-stop")!);
    expect(a.origin).toBe("fixture");
    expect(a.timings.extractionMs).toBeNull();
    for (const c of a.claims) expect(c.match.status).toBe("exact");
    expect(a.claims.find((c) => c.id === "c3")!.evidenceType).toBe("unsupported");
    expect(a.notInferred.map((n) => n.kind)).toEqual(expect.arrayContaining(["exact_time", "emotion", "intent", "legal"]));
  });
});

describe("transcript editing", () => {
  it("requires confirmation again after any change and supports undo", () => {
    let s = reducer(initialState(), { type: "loadScenario", id: "bus-stop", confirmed: true });
    s = reducer(s, { type: "setTranscript", text: "Edited text" });
    expect(s.transcriptConfirmed).toBe(false);
    expect(s.analysis).toBeNull();
    s = reducer(s, { type: "undo" });
    expect(s.transcript).toBe(getScenario("bus-stop")!.transcript);
  });
});

describe("claim actions", () => {
  it("restores the original AI claim", () => {
    const c = fixtureAnalysis(getScenario("bus-stop")!).claims[0]!;
    const edited = applyClaimAction(c, { type: "edit", text: "Something else" });
    expect(edited.userStatus).toBe("edited");
    const restored = applyClaimAction(edited, { type: "restore" });
    expect(restored.userStatus).toBe("pending");
    expect(restored.userEditedClaim).toBeNull();
    expect(restored.claim).toBe(c.originalClaim);
  });

  it("does not turn an unchanged edit of an unsupported claim into acceptance", () => {
    const c3 = fixtureAnalysis(getScenario("bus-stop")!).claims.find((c) => c.id === "c3")!;
    expect(applyClaimAction(c3, { type: "edit", text: c3.originalClaim }).userStatus).toBe("pending");
  });
});

describe("research export", () => {
  it("contains no narrative content", () => {
    const s = populated();
    const json = JSON.stringify(researchExport(s));
    expect(json).not.toMatch(/bus stop|Maghrib|number do|ticket/i);
    const e = researchExport(s);
    expect(e.claims!.accepted).toBe(1);
    expect(e.evidenceOpened).toBe(1);
    expect(e.ratings.perceivedControl).toBe(6);
  });
});
