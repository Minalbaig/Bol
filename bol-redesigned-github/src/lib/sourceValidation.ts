import type { SourceMatch } from "./schema";

/**
 * Deterministic source validation.
 *
 * The model's citation is never trusted. Every excerpt is checked against the
 * confirmed transcript. The transcript itself is only ever read, never changed:
 * all comparisons happen on normalized copies with an index map back to the
 * original characters.
 */

const FUZZY_THRESHOLD = 0.88;
const MIN_FUZZY_TOKENS = 3;

interface Normalized {
  text: string;
  /** map[i] = index in the original string of normalized character i */
  map: number[];
}

const QUOTE_MAP: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u06D4": ".", // Urdu full stop
  "\u060C": ",", // Arabic comma
};

/** Letters and numbers in any script count as content; everything else is a separator. */
function isContentChar(ch: string): boolean {
  return /[\p{L}\p{N}\p{M}]/u.test(ch);
}

export function normalizeWithMap(input: string): Normalized {
  const out: string[] = [];
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < input.length; i++) {
    let ch = input[i] ?? "";
    ch = QUOTE_MAP[ch] ?? ch;
    ch = ch.normalize("NFKC").toLowerCase();
    if (isContentChar(ch)) {
      if (pendingSpace && out.length > 0) {
        out.push(" ");
        map.push(i);
      }
      pendingSpace = false;
      for (const c of ch) {
        out.push(c);
        map.push(i);
      }
    } else {
      pendingSpace = true;
    }
  }
  return { text: out.join(""), map };
}

export function normalizeText(input: string): string {
  return normalizeWithMap(input).text;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? Math.max(a.length, b.length);
}

export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

function rangeFromNormalized(n: Normalized, nStart: number, nEnd: number, original: string) {
  const start = n.map[nStart] ?? 0;
  const lastIdx = n.map[nEnd - 1] ?? start;
  const end = lastIdx + 1;
  return { start, end, matchedText: original.slice(start, end) };
}

const NOT_FOUND: SourceMatch = { status: "not_found", start: null, end: null, matchedText: null, similarity: 0 };

export function validateSource(transcript: string, excerpt: string): SourceMatch {
  if (!excerpt || !excerpt.trim() || !transcript) return { ...NOT_FOUND };

  // 1. Exact match on the raw text.
  const exactIdx = transcript.indexOf(excerpt);
  if (exactIdx >= 0) {
    return {
      status: "exact",
      start: exactIdx,
      end: exactIdx + excerpt.length,
      matchedText: transcript.slice(exactIdx, exactIdx + excerpt.length),
      similarity: 1,
    };
  }

  const nt = normalizeWithMap(transcript);
  const ne = normalizeText(excerpt);
  if (!ne) return { ...NOT_FOUND };

  // 2. Match after normalizing case, punctuation and whitespace.
  const nIdx = nt.text.indexOf(ne);
  if (nIdx >= 0) {
    return { status: "normalized", ...rangeFromNormalized(nt, nIdx, nIdx + ne.length, transcript), similarity: 1 };
  }

  // 3. Conservative fuzzy match over token windows, for small transcription differences only.
  const exTokens = ne.split(" ");
  if (exTokens.length < MIN_FUZZY_TOKENS) return { ...NOT_FOUND };

  const tokenStarts: number[] = [];
  for (let i = 0; i < nt.text.length; i++) {
    if (i === 0 || nt.text[i - 1] === " ") tokenStarts.push(i);
  }
  const tokenEnd = (k: number) => {
    const next = tokenStarts[k + 1];
    return next === undefined ? nt.text.length : next - 1;
  };

  let best = { score: 0, s: -1, e: -1 };
  for (let len = Math.max(1, exTokens.length - 1); len <= exTokens.length + 1; len++) {
    for (let k = 0; k + len <= tokenStarts.length; k++) {
      const s = tokenStarts[k] ?? 0;
      const e = tokenEnd(k + len - 1);
      const score = similarity(nt.text.slice(s, e), ne);
      if (score > best.score) best = { score, s, e };
    }
  }

  if (best.score >= FUZZY_THRESHOLD && best.s >= 0) {
    return { status: "fuzzy", ...rangeFromNormalized(nt, best.s, best.e, transcript), similarity: Number(best.score.toFixed(3)) };
  }
  return { ...NOT_FOUND, similarity: Number(best.score.toFixed(3)) };
}

export function isValidated(match: SourceMatch): boolean {
  return match.status !== "not_found";
}
