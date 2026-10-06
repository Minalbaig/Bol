"use client";

import { useMemo } from "react";
import type { AnalyzedClaim } from "@/lib/schema";

interface Segment {
  start: number;
  end: number;
  claims: AnalyzedClaim[];
}

/** Split the transcript into segments by every claim boundary. The text itself is never altered. */
export function segmentTranscript(transcript: string, claims: AnalyzedClaim[]): Segment[] {
  const located = claims.filter((c) => c.match.start !== null && c.match.end !== null);
  const cuts = new Set<number>([0, transcript.length]);
  for (const c of located) {
    cuts.add(c.match.start as number);
    cuts.add(c.match.end as number);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segs: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i] as number;
    const end = points[i + 1] as number;
    if (end <= start) continue;
    segs.push({
      start,
      end,
      claims: located.filter((c) => (c.match.start as number) <= start && (c.match.end as number) >= end),
    });
  }
  return segs;
}

export function EvidenceTranscript({
  transcript,
  claims,
  selectedId,
  onSelect,
}: {
  transcript: string;
  claims: AnalyzedClaim[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const segments = useMemo(() => segmentTranscript(transcript, claims), [transcript, claims]);
  const order = useMemo(() => new Map(claims.map((c, i) => [c.id, i + 1])), [claims]);

  return (
    <p className="text-[17px] leading-[2]">
      {segments.map((seg) => {
        const text = transcript.slice(seg.start, seg.end);
        if (seg.claims.length === 0) return <span key={seg.start}>{text}</span>;
        const active = seg.claims.find((c) => c.id === selectedId);
        const primary = active ?? seg.claims[0]!;
        const numbers = seg.claims.map((c) => order.get(c.id)).join(", ");
        // A span with role="button" rather than <button>: browsers lay out buttons as unbreakable
        // inline blocks, which would stop the transcript from wrapping naturally.
        return (
          <span
            key={seg.start}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(primary.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(primary.id);
              }
            }}
            aria-label={`${text}. Source for claim ${numbers}.`}
            className={`ev-span ev-${primary.evidenceType} ${active ? "ev-active" : ""}`}
          >
            {text}
          </span>
        );
      })}
    </p>
  );
}
