import type {
  AnalysisResult,
  ExtractionOutput,
  SummaryAuditOutput,
  SummaryAuditResult,
  SummaryResult,
  VerificationOutput,
} from "./schema";
import { assembleAudit, assembleClaims, assembleNotAssumed, filterQuestions, splitStatements } from "./pipeline";
import { normalizeText } from "./sourceValidation";

/**
 * Fictional demonstration data.
 *
 * Every precomputed output here was written by the project author to show the
 * interaction reliably on stage. None of it is a captured model response and
 * the interface labels it "Precomputed demonstration output" wherever it
 * appears. Source validation and the deterministic guards still run on these
 * fixtures for real, so the evaluation numbers they produce are real
 * measurements of those checks.
 *
 * Scenario A's extraction includes one over-reaching claim ("waiting for a
 * bus") so the demo can show the verifier and guards blocking it. This is
 * disclosed in the README.
 */

export interface Scenario {
  id: "bus-stop" | "checkout";
  title: string;
  domain: string;
  description: string;
  transcript: string;
  summary: string;
  extraction: ExtractionOutput;
  verification: VerificationOutput;
  audit: SummaryAuditOutput;
}

const BUS_STOP: Scenario = {
  id: "bus-stop",
  title: "Bus stop account",
  domain: "Sensitive experience (fictional)",
  description: "A fictional mixed Roman Urdu and English account of an encounter at a bus stop.",
  transcript:
    "Kal around 6 baje main bus stop par thi. Ek aadmi kuch der se meri taraf dekh raha tha. Phir woh paas aya aur bola ke apna number do. Maine mana kiya aur thora door chali gayi. Woh dobara paas aya lekin jab bus aa gayi tou main bus mein chali gayi. Mujhe exact time yaad nahi lekin Maghrib se pehle tha. Mere paas bus ticket hai.",
  summary:
    "Yesterday at around 6 PM, the speaker was waiting at a bus stop when a man who had been staring at her for some time approached and asked for her phone number. She refused and moved a short distance away, but he approached her again. When the bus arrived, she boarded it. She does not remember the exact time but says it was before Maghrib (the sunset prayer), and she still has her bus ticket.",
  extraction: {
    claims: [
      {
        id: "c1",
        claim: "This happened 'kal', at around 6 o'clock.",
        category: "time",
        sourceExcerpt: "Kal around 6 baje",
        evidenceType: "approximate",
        confidence: 0.8,
        uncertaintyMarkers: ["around"],
        supportExplanation: "The person gives an approximate time using 'around'. 'Kal' is kept as said.",
      },
      {
        id: "c2",
        claim: "The person was at a bus stop.",
        category: "place",
        sourceExcerpt: "main bus stop par thi",
        evidenceType: "direct",
        confidence: 0.95,
        uncertaintyMarkers: [],
        supportExplanation: "Stated directly.",
      },
      {
        id: "c3",
        claim: "The person was waiting for a bus.",
        category: "action",
        sourceExcerpt: "main bus stop par thi",
        evidenceType: "approximate",
        confidence: 0.6,
        uncertaintyMarkers: [],
        supportExplanation: "Being at a bus stop suggests waiting for a bus.",
      },
      {
        id: "c4",
        claim: "A man had been looking towards the person for some time ('kuch der').",
        category: "action",
        sourceExcerpt: "Ek aadmi kuch der se meri taraf dekh raha tha",
        evidenceType: "approximate",
        confidence: 0.85,
        uncertaintyMarkers: ["kuch der"],
        supportExplanation: "Stated directly. The duration is approximate ('kuch der').",
      },
      {
        id: "c5",
        claim: "He then came close and said 'apna number do' (give your number).",
        category: "speech",
        sourceExcerpt: "Phir woh paas aya aur bola ke apna number do",
        evidenceType: "direct",
        confidence: 0.95,
        uncertaintyMarkers: [],
        supportExplanation: "Stated directly, including his words.",
      },
      {
        id: "c6",
        claim: "The person refused.",
        category: "action",
        sourceExcerpt: "Maine mana kiya",
        evidenceType: "direct",
        confidence: 0.95,
        uncertaintyMarkers: [],
        supportExplanation: "Stated directly.",
      },
      {
        id: "c7",
        claim: "The person moved a little distance away.",
        category: "action",
        sourceExcerpt: "thora door chali gayi",
        evidenceType: "direct",
        confidence: 0.9,
        uncertaintyMarkers: [],
        supportExplanation: "Stated directly.",
      },
      {
        id: "c8",
        claim: "He came close again.",
        category: "action",
        sourceExcerpt: "Woh dobara paas aya",
        evidenceType: "direct",
        confidence: 0.95,
        uncertaintyMarkers: [],
        supportExplanation: "Stated directly.",
      },
      {
        id: "c9",
        claim: "When the bus arrived, the person got on the bus.",
        category: "sequence",
        sourceExcerpt: "jab bus aa gayi tou main bus mein chali gayi",
        evidenceType: "direct",
        confidence: 0.95,
        uncertaintyMarkers: [],
        supportExplanation: "Stated directly.",
      },
      {
        id: "c10",
        claim: "The person does not remember the exact time.",
        category: "memory",
        sourceExcerpt: "Mujhe exact time yaad nahi",
        evidenceType: "direct",
        confidence: 0.95,
        uncertaintyMarkers: ["yaad nahi"],
        supportExplanation: "Stated directly. Not remembering is kept as valid information.",
      },
      {
        id: "c11",
        claim: "It was before Maghrib.",
        category: "time",
        sourceExcerpt: "Maghrib se pehle tha",
        evidenceType: "approximate",
        confidence: 0.85,
        uncertaintyMarkers: ["se pehle"],
        supportExplanation: "A time reference relative to Maghrib, kept in the person's own terms.",
      },
      {
        id: "c12",
        claim: "The person has a bus ticket.",
        category: "object",
        sourceExcerpt: "Mere paas bus ticket hai",
        evidenceType: "direct",
        confidence: 0.95,
        uncertaintyMarkers: [],
        supportExplanation: "Stated directly.",
      },
    ],
    notInferred: [
      {
        kind: "intent",
        note: "The man's intention was not inferred. The account reports what he did and said, not why.",
        relatedExcerpt: "bola ke apna number do",
      },
      {
        kind: "physical",
        note: "No physical contact was assumed. The account does not mention any.",
        relatedExcerpt: "",
      },
      {
        kind: "legal",
        note: "No legal classification was applied to what happened.",
        relatedExcerpt: "",
      },
    ],
    optionalQuestions: ["If you want to, you can add anything else you remember about the place. This is optional."],
  },
  verification: {
    verdicts: [
      { id: "c1", verdict: "approximate", explanation: "The source gives 'around 6', which the claim keeps as approximate." },
      { id: "c2", verdict: "direct", explanation: "The source says this directly." },
      {
        id: "c3",
        verdict: "unsupported",
        explanation: "The source says the person was at a bus stop. It does not say they were waiting for a bus.",
      },
      { id: "c4", verdict: "approximate", explanation: "Directly stated, with an approximate duration." },
      { id: "c5", verdict: "direct", explanation: "The source says this directly." },
      { id: "c6", verdict: "direct", explanation: "The source says this directly." },
      { id: "c7", verdict: "direct", explanation: "The source says this directly." },
      { id: "c8", verdict: "direct", explanation: "The source says this directly." },
      { id: "c9", verdict: "direct", explanation: "The source says this directly." },
      { id: "c10", verdict: "direct", explanation: "The source says this directly." },
      { id: "c11", verdict: "approximate", explanation: "A relative time reference, not a clock time." },
      { id: "c12", verdict: "direct", explanation: "The source says this directly." },
    ],
  },
  audit: {
    statements: [
      {
        id: "s1",
        sourceExcerpt: "Kal around 6 baje main bus stop par thi. Ek aadmi kuch der se meri taraf dekh raha tha. Phir woh paas aya aur bola ke apna number do.",
        verdict: "approximate",
        explanation: "'PM', 'waiting' and 'staring' are not in the source. It says around 6, at a bus stop, and looking towards her.",
      },
      {
        id: "s2",
        sourceExcerpt: "Maine mana kiya aur thora door chali gayi. Woh dobara paas aya",
        verdict: "direct",
        explanation: "Matches what the source says.",
      },
      {
        id: "s3",
        sourceExcerpt: "jab bus aa gayi tou main bus mein chali gayi",
        verdict: "direct",
        explanation: "Matches what the source says.",
      },
      {
        id: "s4",
        sourceExcerpt: "Mujhe exact time yaad nahi lekin Maghrib se pehle tha. Mere paas bus ticket hai.",
        verdict: "approximate",
        explanation: "Mostly matches. 'Still' and the gloss of Maghrib were added by the summary.",
      },
    ],
  },
};

const CHECKOUT: Scenario = {
  id: "checkout",
  title: "Checkout interview",
  domain: "UX research interview (fictional)",
  description: "A fictional usability-test comment about a checkout button, in mixed Roman Urdu and English.",
  transcript:
    "Checkout thora confusing tha. Mujhe laga Continue press karne se payment ho jayegi, but maybe woh next step tha. Main kuch seconds ruk gayi because button clear nahi tha. Exact wording mujhe yaad nahi.",
  summary:
    "The participant found the checkout confusing because the Continue button was unclear. They expected pressing Continue to complete the payment, but it led to the next step instead, which made them hesitate for a few seconds. They could not recall the exact button wording.",
  extraction: {
    claims: [
      {
        id: "b1",
        claim: "The checkout was a little confusing ('thora confusing').",
        category: "opinion",
        sourceExcerpt: "Checkout thora confusing tha",
        evidenceType: "approximate",
        confidence: 0.85,
        uncertaintyMarkers: ["thora"],
        supportExplanation: "Stated directly, softened with 'thora' (a little).",
      },
      {
        id: "b2",
        claim: "The participant thought pressing Continue would make the payment.",
        category: "opinion",
        sourceExcerpt: "Mujhe laga Continue press karne se payment ho jayegi",
        evidenceType: "direct",
        confidence: 0.9,
        uncertaintyMarkers: ["laga"],
        supportExplanation: "Stated directly as what the participant thought ('mujhe laga').",
      },
      {
        id: "b3",
        claim: "The participant says maybe it was the next step instead.",
        category: "opinion",
        sourceExcerpt: "but maybe woh next step tha",
        evidenceType: "approximate",
        confidence: 0.8,
        uncertaintyMarkers: ["maybe"],
        supportExplanation: "The participant is unsure, using 'maybe'.",
      },
      {
        id: "b4",
        claim: "The participant paused for a few seconds ('kuch seconds').",
        category: "action",
        sourceExcerpt: "Main kuch seconds ruk gayi",
        evidenceType: "approximate",
        confidence: 0.85,
        uncertaintyMarkers: ["kuch seconds"],
        supportExplanation: "Stated directly. The duration is approximate.",
      },
      {
        id: "b5",
        claim: "The participant says they paused because the button was not clear.",
        category: "opinion",
        sourceExcerpt: "because button clear nahi tha",
        evidenceType: "direct",
        confidence: 0.9,
        uncertaintyMarkers: [],
        supportExplanation: "The participant gives this reason directly.",
      },
      {
        id: "b6",
        claim: "The participant does not remember the exact wording.",
        category: "memory",
        sourceExcerpt: "Exact wording mujhe yaad nahi",
        evidenceType: "direct",
        confidence: 0.95,
        uncertaintyMarkers: ["yaad nahi"],
        supportExplanation: "Stated directly.",
      },
    ],
    notInferred: [
      {
        kind: "emotion",
        note: "Frustration was not inferred. The participant's own words, 'thora confusing', were kept.",
        relatedExcerpt: "thora confusing",
      },
      {
        kind: "severity",
        note: "No usability severity rating was assigned to the issue.",
        relatedExcerpt: "",
      },
    ],
    optionalQuestions: ["If you want, you can describe what you expected to see after pressing Continue."],
  },
  verification: {
    verdicts: [
      { id: "b1", verdict: "approximate", explanation: "Kept with the softening word 'thora'." },
      { id: "b2", verdict: "direct", explanation: "The source says this directly." },
      { id: "b3", verdict: "approximate", explanation: "The claim keeps 'maybe'." },
      { id: "b4", verdict: "approximate", explanation: "No number of seconds is given in the source." },
      { id: "b5", verdict: "direct", explanation: "The source says this directly." },
      { id: "b6", verdict: "direct", explanation: "The source says this directly." },
    ],
  },
  audit: {
    statements: [
      {
        id: "s1",
        sourceExcerpt: "Checkout thora confusing tha.",
        verdict: "approximate",
        explanation: "'Thora' (a little) was dropped. The source links the pause, not the confusion, to the unclear button.",
      },
      {
        id: "s2",
        sourceExcerpt: "but maybe woh next step tha",
        verdict: "unsupported",
        explanation: "The source says 'maybe' it was the next step. The summary states it as fact.",
      },
      {
        id: "s3",
        sourceExcerpt: "Exact wording mujhe yaad nahi.",
        verdict: "approximate",
        explanation: "The source does not say whose wording. 'Button' was added.",
      },
    ],
  },
};

export const SCENARIOS: Scenario[] = [BUS_STOP, CHECKOUT];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** A fixture only applies when the confirmed transcript is the unedited scenario text. */
export function findFixtureForTranscript(transcript: string): Scenario | undefined {
  const n = normalizeText(transcript);
  return SCENARIOS.find((s) => normalizeText(s.transcript) === n);
}

export function fixtureSummary(s: Scenario): SummaryResult {
  return { summary: s.summary, origin: "fixture", ms: null };
}

export function fixtureAnalysis(s: Scenario): AnalysisResult {
  return {
    claims: assembleClaims(s.transcript, s.extraction, s.verification),
    notInferred: assembleNotAssumed(s.transcript, s.extraction.notInferred),
    optionalQuestions: filterQuestions(s.extraction.optionalQuestions),
    timings: { extractionMs: null, verificationMs: null },
    origin: "fixture",
  };
}

export function fixtureAudit(s: Scenario): SummaryAuditResult {
  return {
    statements: assembleAudit(s.transcript, splitStatements(s.summary), s.audit),
    origin: "fixture",
    ms: null,
  };
}
