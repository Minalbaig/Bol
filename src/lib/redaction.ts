/**
 * Detection of possibly identifying details. This is a helper, not a
 * guarantee: it suggests spans for the person to review and only changes the
 * transcript when they choose to redact.
 */

export interface DetectedDetail {
  kind: "phone" | "email" | "id_number" | "link" | "handle" | "name" | "address";
  label: string;
  start: number;
  end: number;
  text: string;
}

export const REDACTION_MARK = "[redacted]";

const PATTERNS: { kind: DetectedDetail["kind"]; label: string; re: RegExp }[] = [
  { kind: "email", label: "Email address", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { kind: "id_number", label: "ID number", re: /\b\d{5}-\d{7}-\d\b/g },
  { kind: "phone", label: "Phone number", re: /(?:\+?\d[\d\s-]{8,}\d)/g },
  { kind: "link", label: "Link", re: /\bhttps?:\/\/\S+|\bwww\.\S+/gi },
  { kind: "handle", label: "Social media handle", re: /(?<![\w.])@[A-Za-z0-9_]{3,}/g },
  {
    kind: "name",
    label: "Possible name",
    re: /\b(?:[Mm]y name is|[Mm]era naam|[Mm]eri dost|is named|named|called)\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?)/gu,
  },
  {
    kind: "address",
    label: "Possible address",
    re: /\b(?:house|flat|apartment|plot)\s*(?:no\.?|number|#)?\s*\d+[\w/-]*|\b(?:street|gali|block|sector|road)\s*(?:no\.?|#)?\s*\d+[\w/-]*/gi,
  },
];

export function detectIdentifyingDetails(text: string): DetectedDetail[] {
  const found: DetectedDetail[] = [];
  for (const p of PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      if (m.index === undefined) continue;
      let start = m.index;
      let value = m[0];
      if (p.kind === "name" && m[1]) {
        start = m.index + m[0].lastIndexOf(m[1]);
        value = m[1];
      }
      const end = start + value.length;
      if (found.some((f) => start < f.end && end > f.start)) continue;
      found.push({ kind: p.kind, label: p.label, start, end, text: value });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** Replace one range with a redaction mark. Returns a new string; the input is not modified. */
export function redactRange(text: string, start: number, end: number): string {
  if (start < 0 || end > text.length || start >= end) return text;
  return `${text.slice(0, start)}${REDACTION_MARK}${text.slice(end)}`;
}

export function redactAll(text: string, details: DetectedDetail[]): string {
  return [...details].sort((a, b) => b.start - a.start).reduce((t, d) => redactRange(t, d.start, d.end), text);
}
