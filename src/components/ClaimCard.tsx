"use client";

import { useState } from "react";
import type { AnalyzedClaim, MatchStatus } from "@/lib/schema";
import type { ClaimAction } from "@/lib/session";
import { Button, EvidenceBadge, STATUS_LABEL } from "./ui";

const MATCH_TEXT: Record<MatchStatus, string> = {
  exact: "Found word for word in the transcript",
  normalized: "Found in the transcript, ignoring punctuation and capitals",
  fuzzy: "Close match in the transcript, allowing for small transcription differences",
  not_found: "These words were not found in the transcript",
};

function confidenceLabel(c: number) {
  if (c >= 0.8) return "High";
  if (c >= 0.5) return "Medium";
  return "Low";
}

const STATUS_STYLE: Record<AnalyzedClaim["userStatus"], string> = {
  pending: "text-muted",
  accepted: "text-blue",
  edited: "text-blue",
  rejected: "text-slate line-through decoration-1",
  uncertain: "text-lav",
};

export function ClaimCard({
  claim,
  index,
  selected,
  showTechnical,
  onAction,
  onViewSource,
}: {
  claim: AnalyzedClaim;
  index: number;
  selected: boolean;
  showTechnical: boolean;
  onAction: (a: ClaimAction) => void;
  onViewSource: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(claim.userEditedClaim ?? claim.claim);
  const [confirmKeep, setConfirmKeep] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  const weak = claim.evidenceType === "unsupported" || claim.evidenceType === "unknown";
  const shown = claim.userStatus === "edited" && claim.userEditedClaim ? claim.userEditedClaim : claim.claim;
  const changed = claim.userStatus !== "pending";
  const headingId = `claim-${claim.id}-text`;

  return (
    <article
      id={`claim-${claim.id}`}
      aria-labelledby={headingId}
      className={`rounded-xl border bg-surface p-4 sm:p-5 ${
        selected ? "border-[#e7c94b] ring-2 ring-[#e7c94b]/60" : weak ? "border-dashed border-[#9ca3af]" : "border-line"
      } ${claim.userStatus === "rejected" ? "opacity-75" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-muted">Claim {index + 1}</span>
        <EvidenceBadge type={claim.evidenceType} />
        <span className="rounded-full bg-mist px-2.5 py-0.5 text-[13px] text-slate">{claim.category}</span>
        <span className="text-[13px] text-slate" title="How closely the model estimates the claim matches the cited words. Not a judgement of truth.">
          Match confidence: {confidenceLabel(claim.confidence)} ({claim.confidence.toFixed(2)})
        </span>
      </div>

      {editing ? (
        <div className="mt-3">
          <label htmlFor={`edit-${claim.id}`} className="text-sm font-semibold">
            Your wording
          </label>
          <textarea
            id={`edit-${claim.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={600}
            className="mt-1 w-full rounded-lg border border-line bg-paper p-3 text-[16px]"
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={!text.trim()}
              onClick={() => {
                onAction({ type: "edit", text });
                setEditing(false);
              }}
            >
              Save wording
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setText(claim.userEditedClaim ?? claim.claim);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p id={headingId} className={`mt-3 text-[18px] leading-snug ${claim.userStatus === "rejected" ? "line-through decoration-1 text-slate" : "text-ink"}`}>
          {shown}
        </p>
      )}
      {claim.userStatus === "edited" && !editing && (
        <p className="mt-1 text-sm text-slate">
          AI wording: <span className="italic">{claim.originalClaim}</span>
        </p>
      )}

      <p className="mt-3 text-[15px] text-slate">{claim.supportExplanation}</p>

      {claim.uncertaintyMarkers.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-slate">Uncertainty kept:</span>
          {claim.uncertaintyMarkers.map((m) => (
            <span key={m} className="rounded border border-lav/40 bg-lav-soft px-1.5 py-0.5 font-semibold text-lav">
              {m}
            </span>
          ))}
        </p>
      )}

      {claim.guardFlags.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-[#3f4553]">
          {claim.guardFlags.map((f, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true">⊘</span>
              <span>
                <span className="font-semibold">Blocked by Bol&rsquo;s checks:</span> {f.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <button
          type="button"
          aria-expanded={sourceOpen}
          aria-controls={`src-${claim.id}`}
          onClick={() => {
            if (!sourceOpen) onViewSource();
            setSourceOpen(!sourceOpen);
          }}
          className="text-[15px] font-semibold text-blue underline-offset-4 hover:underline"
        >
          {sourceOpen ? "Hide source" : "View exact source"}
        </button>
        {sourceOpen && (
          <div id={`src-${claim.id}`} className="reveal mt-2 rounded-lg border-l-4 border-blue bg-blue-soft/60 p-3">
            {claim.match.matchedText ? (
              <blockquote className="text-[16px] leading-relaxed text-ink">&ldquo;{claim.match.matchedText}&rdquo;</blockquote>
            ) : (
              <p className="text-[15px] text-ink">
                The model cited: <span className="italic">&ldquo;{claim.sourceExcerpt || "nothing"}&rdquo;</span>
              </p>
            )}
            <p className="mt-1 text-sm text-slate">
              {MATCH_TEXT[claim.match.status]}
              {claim.match.status === "fuzzy" && ` (similarity ${(claim.match.similarity * 100).toFixed(0)}%)`}.
            </p>
            {showTechnical && (
              <p className="mt-2 text-[13px] text-slate">
                Extractor said {claim.extractorEvidenceType}; verifier said {claim.verifierVerdict ?? "not run"}
                {claim.verifierExplanation ? ` (${claim.verifierExplanation})` : ""}. Characters {claim.match.start ?? "–"} to{" "}
                {claim.match.end ?? "–"}.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p className={`text-sm font-semibold ${STATUS_STYLE[claim.userStatus]}`}>
          <span className="sr-only">Your decision: </span>
          {STATUS_LABEL[claim.userStatus]}
        </p>
        {!editing && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Decide on claim ${index + 1}`}>
            <Button
              size="sm"
              variant={claim.userStatus === "accepted" ? "primary" : "secondary"}
              aria-pressed={claim.userStatus === "accepted"}
              onClick={() => (weak && claim.userStatus !== "accepted" ? setConfirmKeep(true) : onAction({ type: "accept" }))}
            >
              Accept
            </Button>
            <Button size="sm" aria-pressed={claim.userStatus === "edited"} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" aria-pressed={claim.userStatus === "rejected"} onClick={() => onAction({ type: "reject" })}>
              Reject
            </Button>
            <Button size="sm" aria-pressed={claim.userStatus === "uncertain"} onClick={() => onAction({ type: "uncertain" })}>
              Mark uncertain
            </Button>
            {changed && (
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  setText(claim.originalClaim);
                  onAction({ type: "restore" });
                }}
              >
                Restore original
              </Button>
            )}
          </div>
        )}
      </div>

      {confirmKeep && (
        <div role="alertdialog" aria-labelledby={`keep-${claim.id}`} className="reveal mt-3 rounded-lg border border-dashed border-[#6b7280] bg-stone-soft p-3">
          <p id={`keep-${claim.id}`} className="text-[15px]">
            This claim is not supported by your words. If you keep it, your narrative will show it separately as kept without
            verified support. Editing it into your own wording may be clearer.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onAction({ type: "accept" });
                setConfirmKeep(false);
              }}
            >
              Keep anyway
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setConfirmKeep(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
