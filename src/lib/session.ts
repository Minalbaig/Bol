import type { AnalysisResult, AnalyzedClaim, SummaryAuditResult, SummaryResult } from "./schema";
import { getScenario } from "./fixtures";

/**
 * All session data lives in this in-memory state. Nothing is written to
 * localStorage, cookies, a database or analytics. Deleting the session
 * returns everything to the initial state.
 */

export type Step = "intro" | "input" | "transcript" | "compare" | "narrative";
export type InputSource = "typed" | "recorded" | "uploaded" | "demo";
export type DataMode = "live" | "fixture";
export type ClaimAction =
  | { type: "accept" }
  | { type: "reject" }
  | { type: "uncertain" }
  | { type: "edit"; text: string }
  | { type: "restore" };

export interface ResearchRatings {
  perceivedControl: number | null;
  appropriateTrust: number | null;
  easeOfVerification: number | null;
  confidenceInOutput: number | null;
  mentalEffort: number | null;
}

export interface ResearchState {
  enabled: boolean;
  consented: boolean;
  condition: "baseline" | "bol";
  participantCode: string;
  reviewStartedAt: number | null;
  reviewEndedAt: number | null;
  evidenceOpens: number;
  summaryEdits: number;
  summaryAuditRun: boolean;
  ratings: ResearchRatings;
  submitted: boolean;
}

export interface SessionState {
  step: Step;
  consented: boolean;
  transcript: string;
  history: string[];
  transcriptConfirmed: boolean;
  inputSource: InputSource | null;
  scenarioId: string | null;
  summary: SummaryResult | null;
  summaryText: string;
  audit: SummaryAuditResult | null;
  analysis: AnalysisResult | null;
  narrativeGeneratedAt: string | null;
  mode: DataMode;
  simulateFailure: boolean;
  showTechnical: boolean;
  research: ResearchState;
}

export const EMPTY_RATINGS: ResearchRatings = {
  perceivedControl: null,
  appropriateTrust: null,
  easeOfVerification: null,
  confidenceInOutput: null,
  mentalEffort: null,
};

export function initialResearch(): ResearchState {
  return {
    enabled: false,
    consented: false,
    condition: "bol",
    participantCode: "",
    reviewStartedAt: null,
    reviewEndedAt: null,
    evidenceOpens: 0,
    summaryEdits: 0,
    summaryAuditRun: false,
    ratings: { ...EMPTY_RATINGS },
    submitted: false,
  };
}

export function initialState(mode: DataMode = "fixture"): SessionState {
  return {
    step: "intro",
    consented: false,
    transcript: "",
    history: [],
    transcriptConfirmed: false,
    inputSource: null,
    scenarioId: null,
    summary: null,
    summaryText: "",
    audit: null,
    analysis: null,
    narrativeGeneratedAt: null,
    mode,
    simulateFailure: false,
    showTechnical: false,
    research: initialResearch(),
  };
}

export type SessionEvent =
  | { type: "consent"; value: boolean }
  | { type: "goto"; step: Step }
  | { type: "setTranscript"; text: string; source?: InputSource; record?: boolean }
  | { type: "undo" }
  | { type: "confirmTranscript"; value: boolean }
  | { type: "loadScenario"; id: string; confirmed: boolean }
  | { type: "setSummary"; result: SummaryResult }
  | { type: "editSummary"; text: string }
  | { type: "setAudit"; result: SummaryAuditResult }
  | { type: "setAnalysis"; result: AnalysisResult }
  | { type: "claim"; id: string; action: ClaimAction }
  | { type: "generateNarrative"; at: string; now: number }
  | { type: "deleteSession" }
  | { type: "setMode"; mode: DataMode }
  | { type: "setSimulateFailure"; value: boolean }
  | { type: "setShowTechnical"; value: boolean }
  | { type: "research"; patch: Partial<ResearchState> }
  | { type: "researchEvidenceOpened" }
  | { type: "rate"; key: keyof ResearchRatings; value: number };

/** Clears everything derived from a transcript. */
function clearDerived(s: SessionState): SessionState {
  return { ...s, summary: null, summaryText: "", audit: null, analysis: null, narrativeGeneratedAt: null };
}

export function applyClaimAction(claim: AnalyzedClaim, action: ClaimAction): AnalyzedClaim {
  switch (action.type) {
    case "accept":
      return { ...claim, userStatus: "accepted", userEditedClaim: null };
    case "reject":
      return { ...claim, userStatus: "rejected" };
    case "uncertain":
      return { ...claim, userStatus: "uncertain" };
    case "edit": {
      const text = action.text.trim();
      if (!text) return claim;
      if (text === claim.originalClaim.trim()) {
        // Saving the AI wording unchanged is not an edit. For weakly supported claims it must not
        // become an acceptance either; that needs the explicit "keep anyway" step.
        const weak = claim.evidenceType === "unsupported" || claim.evidenceType === "unknown";
        return weak ? { ...claim, userStatus: "pending", userEditedClaim: null } : { ...claim, userStatus: "accepted", userEditedClaim: null };
      }
      return { ...claim, userStatus: "edited", userEditedClaim: text };
    }
    case "restore":
      return { ...claim, claim: claim.originalClaim, userStatus: "pending", userEditedClaim: null };
  }
}

export function reducer(s: SessionState, e: SessionEvent): SessionState {
  switch (e.type) {
    case "consent":
      return { ...s, consented: e.value };
    case "goto": {
      const next = { ...s, step: e.step };
      if (e.step === "compare" && s.research.enabled && s.research.reviewStartedAt === null) {
        next.research = { ...s.research, reviewStartedAt: Date.now() };
      }
      return next;
    }
    case "setTranscript": {
      if (e.text === s.transcript) return s;
      const history = e.record === false ? s.history : [...s.history, s.transcript].slice(-50);
      return clearDerived({
        ...s,
        transcript: e.text,
        history,
        transcriptConfirmed: false,
        inputSource: e.source ?? s.inputSource,
        scenarioId: e.source && e.source !== "demo" ? null : s.scenarioId,
      });
    }
    case "undo": {
      if (s.history.length === 0) return s;
      const prev = s.history[s.history.length - 1] ?? "";
      return clearDerived({ ...s, transcript: prev, history: s.history.slice(0, -1), transcriptConfirmed: false });
    }
    case "confirmTranscript":
      return { ...s, transcriptConfirmed: e.value && s.transcript.trim().length > 0 };
    case "loadScenario": {
      const sc = getScenario(e.id);
      if (!sc) return s;
      return clearDerived({
        ...s,
        consented: true,
        transcript: sc.transcript,
        history: [],
        inputSource: "demo",
        scenarioId: sc.id,
        transcriptConfirmed: e.confirmed,
        step: e.confirmed ? "compare" : "transcript",
      });
    }
    case "setSummary":
      return { ...s, summary: e.result, summaryText: e.result.summary, audit: null };
    case "editSummary":
      return {
        ...s,
        summaryText: e.text,
        audit: null,
        research: { ...s.research, summaryEdits: s.research.summaryEdits + 1 },
      };
    case "setAudit":
      return { ...s, audit: e.result, research: { ...s.research, summaryAuditRun: true } };
    case "setAnalysis":
      return { ...s, analysis: e.result };
    case "claim": {
      if (!s.analysis) return s;
      return {
        ...s,
        analysis: {
          ...s.analysis,
          claims: s.analysis.claims.map((c) => (c.id === e.id ? applyClaimAction(c, e.action) : c)),
        },
      };
    }
    case "generateNarrative":
      return {
        ...s,
        step: "narrative",
        narrativeGeneratedAt: e.at,
        research: s.research.enabled && s.research.reviewEndedAt === null ? { ...s.research, reviewEndedAt: e.now } : s.research,
      };
    case "deleteSession":
      // Keeps only presenter settings. All narrative content and metrics are discarded.
      return { ...initialState(s.mode), showTechnical: s.showTechnical };
    case "setMode":
      return { ...s, mode: e.mode };
    case "setSimulateFailure":
      return { ...s, simulateFailure: e.value };
    case "setShowTechnical":
      return { ...s, showTechnical: e.value };
    case "research":
      return { ...s, research: { ...s.research, ...e.patch } };
    case "researchEvidenceOpened":
      return { ...s, research: { ...s.research, evidenceOpens: s.research.evidenceOpens + 1 } };
    case "rate":
      return { ...s, research: { ...s.research, ratings: { ...s.research.ratings, [e.key]: e.value } } };
  }
}
