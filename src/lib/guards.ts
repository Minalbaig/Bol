import type { EvidenceType, GuardFlag, GuardKind, NotInferred } from "./schema";
import { normalizeText } from "./sourceValidation";

/**
 * Deterministic checks that run on every claim, live or precomputed.
 * They are deliberately conservative: a flag downgrades a claim to
 * "unsupported" so it cannot enter the final narrative without the person
 * explicitly choosing to keep it. They do not decide what is true.
 */

interface Term {
  kind: Exclude<GuardKind, "exactness" | "uncertainty_removed">;
  pattern: RegExp;
  label: string;
}

const w = (stem: string) => new RegExp(`(^|[^\\p{L}])${stem}`, "u");

const TERMS: Term[] = [
  // Emotional or psychological states
  ...[
    "terrif", "scare", "afraid", "fright", "fear", "panic", "anxi", "upset", "distress", "trauma",
    "shock", "nervous", "angry", "anger", "frustrat", "humiliat", "ashamed", "embarrass", "helpless",
    "worri", "overwhelm", "disturb", "uncomfortable", "unsafe", "threatened", "intimidat", "horrif",
    "devastat", "confus", "ptsd", "depress", "ghabra", "darr", "khauf", "pareshan",
  ].map((s) => ({ kind: "emotion" as const, pattern: w(s), label: s })),
  // Intent or motive
  ...[
    "intend", "intent", "deliberate", "on purpose", "purposely", "wanted to", "tried to", "trying to",
    "meant to", "planned", "in order to", "aimed", "motive", "predator", "targeted", "targeting",
  ].map((s) => ({ kind: "intent" as const, pattern: w(s), label: s })),
  // Legal or evidential framing
  ...[
    "harass", "assault", "stalk", "crime", "criminal", "offence", "offense", "illegal", "unlawful",
    "perpetrator", "victim", "survivor", "abus", "molest", "violat", "guilty", "suspect", "evidence",
    "proof", "witness",
  ].map((s) => ({ kind: "legal" as const, pattern: w(s), label: s })),
  // Escalation of what physically happened
  ...[
    "attack", "grabb", "grabs", "touch", "chase", "follow", "fled", "flee", "escap", "push", "hit ",
    "forced", "cornered", "threat",
  ].map((s) => ({ kind: "escalation" as const, pattern: w(s), label: s.trim() })),
];

/** Words that mark approximation or uncertainty in English, Roman Urdu and Urdu script. */
export const HEDGES = [
  "around", "about", "approximately", "approx", "roughly", "maybe", "perhaps", "probably", "possibly",
  "i think", "not sure", "don't remember", "do not remember", "dont remember", "some", "a few", "a little",
  "sort of", "kind of", "nearly", "almost", "or so",
  "kuch", "thora", "thoda", "takreeban", "taqreeban", "lagbhag", "shayad", "shaid", "kareeb", "qareeb",
  "yaad nahi", "pata nahi", "laga",
  "تقریباً", "شاید", "کچھ", "تھوڑا", "یاد نہیں", "پتا نہیں",
];

const hedgeRegex = (h: string) => new RegExp(`(^|[^\\p{L}])${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u");

export function findHedges(text: string): string[] {
  const n = normalizeText(text);
  return HEDGES.filter((h) => hedgeRegex(normalizeText(h)).test(n));
}

const MESSAGES: Record<GuardKind, (term: string) => string> = {
  emotion: (t) => `Describes a feeling ("${t}…") that the cited words do not state.`,
  intent: (t) => `Attributes intent or motive ("${t}…") that the cited words do not state.`,
  legal: (t) => `Uses legal or evidential framing ("${t}…") that the cited words do not use.`,
  escalation: (t) => `Describes an action ("${t}…") that the cited words do not describe.`,
  exactness: (t) => `States a more specific value ("${t}") than the cited words give.`,
  uncertainty_removed: (t) => `Drops the approximation in the source ("${t}") and sounds more exact than it is.`,
};

const TIME_EXACT = /\b\d{1,2}:\d{2}\s*(am|pm|a\.m\.|p\.m\.)?|\b\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)(?![\p{L}])/giu;
const EXACT_WORDS = ["exactly", "precisely", "sharp", "on the dot"];

/** Check one statement against the words it cites. Returns every flag found. */
export function checkStatement(statement: string, source: string): GuardFlag[] {
  const flags: GuardFlag[] = [];
  const nClaim = normalizeText(statement);
  const nSource = normalizeText(source);

  for (const term of TERMS) {
    if (term.pattern.test(nClaim) && !term.pattern.test(nSource)) {
      if (!flags.some((f) => f.kind === term.kind)) {
        flags.push({ kind: term.kind, term: term.label, message: MESSAGES[term.kind](term.label) });
      }
    }
  }

  // Exact clock times that are not literally in the source.
  const lowerSource = source.toLowerCase();
  for (const m of statement.matchAll(TIME_EXACT)) {
    const found = m[0].trim();
    if (!lowerSource.includes(found.toLowerCase())) {
      flags.push({ kind: "exactness", term: found, message: MESSAGES.exactness(found) });
      break;
    }
  }
  for (const word of EXACT_WORDS) {
    if (nClaim.includes(word) && !nSource.includes(word)) {
      flags.push({ kind: "exactness", term: word, message: MESSAGES.exactness(word) });
      break;
    }
  }
  // Numbers that do not appear in the source at all.
  const claimNumbers = nClaim.match(/\d+/g) ?? [];
  const sourceNumbers = new Set(nSource.match(/\d+/g) ?? []);
  const invented = claimNumbers.find((num) => !sourceNumbers.has(num));
  if (invented && !flags.some((f) => f.kind === "exactness")) {
    flags.push({ kind: "exactness", term: invented, message: MESSAGES.exactness(invented) });
  }

  // A number hedged in the source ("around 6") repeated in the claim without any hedge.
  const sourceHedges = findHedges(source);
  if (sourceHedges.length > 0) {
    const claimHedges = findHedges(statement);
    const hedgedNumber = claimNumbers.find((num) => sourceNumbers.has(num));
    if (hedgedNumber && claimHedges.length === 0) {
      flags.push({
        kind: "uncertainty_removed",
        term: sourceHedges[0] ?? "",
        message: MESSAGES.uncertainty_removed(sourceHedges[0] ?? ""),
      });
    }
  }

  return flags;
}

const RANK: Record<EvidenceType, number> = { direct: 0, approximate: 1, unknown: 2, unsupported: 3 };

/** The most conservative of several judgements wins. */
export function mostConservative(...types: (EvidenceType | null | undefined)[]): EvidenceType {
  let result: EvidenceType = "direct";
  for (const t of types) if (t && RANK[t] > RANK[result]) result = t;
  return result;
}

/* ---------- "What Bol did not assume" ---------- */

const EMOTION_IN_TEXT = TERMS.filter((t) => t.kind === "emotion");

/**
 * Deterministic items derived from the transcript itself. They are only
 * produced when relevant to the current narrative.
 */
export function deriveNotAssumed(transcript: string): NotInferred[] {
  const items: NotInferred[] = [];
  const n = normalizeText(transcript);

  const hedgedTime = transcript.match(
    /\b(around|about|approximately|takreeban|taqreeban|lagbhag|kareeb|qareeb)\s+\d{1,2}(\s*(baje|bajay|o'clock|pm|am))?/i,
  );
  if (hedgedTime) {
    items.push({
      kind: "exact_time",
      note: `"${hedgedTime[0]}" was kept as an approximate time and not converted into an exact clock time.`,
      relatedExcerpt: hedgedTime[0],
    });
  }

  const hedgedDuration = transcript.match(/\b(kuch|a few|some|thora|thoda)\s+(seconds|second|minutes|minute|der)\b/i);
  if (hedgedDuration) {
    items.push({
      kind: "other",
      note: `"${hedgedDuration[0]}" was kept as an approximate duration. No specific number was assigned.`,
      relatedExcerpt: hedgedDuration[0],
    });
  }

  if (!EMOTION_IN_TEXT.some((t) => t.pattern.test(n))) {
    items.push({
      kind: "emotion",
      note: "No emotional state was inferred. The account describes what happened but does not name a feeling.",
      relatedExcerpt: "",
    });
  }
  return items;
}

/** Merge model-proposed and deterministic items, one per kind, deterministic first. */
export function mergeNotAssumed(deterministic: NotInferred[], proposed: NotInferred[], transcript: string): NotInferred[] {
  const out: NotInferred[] = [...deterministic];
  const nTranscript = normalizeText(transcript);
  for (const item of proposed) {
    if (out.some((o) => o.kind === item.kind && item.kind !== "other")) continue;
    // A model-proposed item must not cite words that are not in the transcript.
    if (item.relatedExcerpt && !nTranscript.includes(normalizeText(item.relatedExcerpt))) {
      out.push({ ...item, relatedExcerpt: "" });
    } else {
      out.push(item);
    }
  }
  return out.slice(0, 8);
}

/** Optional questions must be neutral: no emotional, legal or intent framing and no pressure. */
export function isNeutralQuestion(q: string): boolean {
  const n = normalizeText(q);
  if (TERMS.some((t) => t.kind !== "escalation" && t.pattern.test(n))) return false;
  if (/\b(why didn ?t|why did you not|you should|you must|need to|have to)\b/.test(n)) return false;
  return true;
}
