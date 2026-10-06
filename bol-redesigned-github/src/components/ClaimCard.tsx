"use client";

import { useState } from "react";
import type { AnalyzedClaim, MatchStatus } from "@/lib/schema";
import type { ClaimAction } from "@/lib/session";
import { Button, EvidenceBadge, STATUS_LABEL } from "./ui";

const MATCH_TEXT: Record<MatchStatus, string> = {
  exact: "The cited words were found exactly in the transcript.",
  normalized: "The cited words match after ignoring punctuation and capitals.",
  fuzzy: "The cited words are a close text match and should be checked.",
  not_found: "The cited words were not found in the transcript.",
};

const STATUS_STYLE: Record<AnalyzedClaim["userStatus"], string> = {
  pending: "text-muted",
  accepted: "text-blue",
  edited: "text-blue",
  rejected: "text-coral",
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
  onAction: (action: ClaimAction) => void;
  onViewSource: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(claim.userEditedClaim ?? claim.claim);
  const [confirmKeep, setConfirmKeep] = useState(false);
  const weak = claim.evidenceType === "unsupported" || claim.evidenceType === "unknown";
  const shown = claim.userStatus === "edited" && claim.userEditedClaim ? claim.userEditedClaim : claim.claim;
  const source = claim.match.matchedText || claim.sourceExcerpt;
  const headingId = `claim-${claim.id}-text`;

  return (
    <article
      id={`claim-${claim.id}`}
      aria-labelledby={headingId}
      className={`rounded-2xl border p-4 transition-colors sm:p-5 ${
        selected
          ? "border-blue bg-blue-soft/20 ring-2 ring-blue/20"
          : weak
            ? "border-coral/35 bg-coral-soft/20"
            : "border-line bg-surface"
      } ${claim.userStatus === "rejected" ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted">Suggestion {index + 1}</span>
        <EvidenceBadge type={claim.evidenceType} />
      </div>

      {editing ? (
        <div className="mt-3">
          <label htmlFor={`edit-${claim.id}`} className="text-sm font-bold">Put it in your words</label>
          <textarea
            id={`edit-${claim.id}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={600}
            className="mt-2 w-full rounded-xl border border-line bg-paper p-3 text-[16px]"
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
              Save my wording
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
        <p id={headingId} className={`mt-3 text-[18px] font-semibold leading-snug ${claim.userStatus === "rejected" ? "line-through text-slate" : "text-ink"}`}>
          {shown}
        </p>
      )}

      {claim.userStatus === "edited" && !editing && (
        <p className="mt-1 text-[13px] text-slate">AI originally wrote: “{claim.originalClaim}”</p>
      )}

      <button
        type="button"
        onClick={onViewSource}
        className="mt-3 block w-full rounded-xl border border-line bg-paper p-3 text-left hover:border-blue/35"
      >
        <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-muted">From your words</span>
        <span className="mt-1 block text-[14px] leading-relaxed text-ink">{source ? `“${source}”` : "No matching words found"}</span>
      </button>

      {claim.uncertaintyMarkers.length > 0 && (
        <p className="mt-2 text-[13px] text-slate">
          Uncertainty preserved: <span className="font-semibold text-lav">{claim.uncertaintyMarkers.join(", ")}</span>
        </p>
      )}

      <details className="mt-3 text-[13px] text-slate">
        <summary className="cursor-pointer font-semibold text-blue">Why this label?</summary>
        <p className="mt-2 leading-relaxed">{claim.supportExplanation}</p>
        <p className="mt-1 leading-relaxed">{MATCH_TEXT[claim.match.status]}</p>
        {claim.guardFlags.map((flag, flagIndex) => (
          <p key={flagIndex} className="mt-1 leading-relaxed text-coral">Check raised: {flag.message}</p>
        ))}
        {showTechnical && (
          <p className="mt-2 rounded-lg bg-mist p-2 text-[12px]">
            Extractor: {claim.extractorEvidenceType}; second pass: {claim.verifierVerdict ?? "not run"}; source characters {claim.match.start ?? "–"}–{claim.match.end ?? "–"}.
          </p>
        )}
      </details>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p className={`text-[13px] font-bold ${STATUS_STYLE[claim.userStatus]}`}>
          <span className="sr-only">Your decision: </span>{STATUS_LABEL[claim.userStatus]}
        </p>
        {!editing && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Decide on suggestion ${index + 1}`}>
            <Button
              size="sm"
              variant={claim.userStatus === "accepted" ? "primary" : "secondary"}
              aria-pressed={claim.userStatus === "accepted"}
              onClick={() => (weak && claim.userStatus !== "accepted" ? setConfirmKeep(true) : onAction({ type: "accept" }))}
            >
              Keep
            </Button>
            <Button size="sm" aria-pressed={claim.userStatus === "edited"} onClick={() => setEditing(true)}>Rewrite</Button>
            <Button size="sm" aria-pressed={claim.userStatus === "rejected"} onClick={() => onAction({ type: "reject" })}>Remove</Button>
            <Button size="sm" aria-pressed={claim.userStatus === "uncertain"} onClick={() => onAction({ type: "uncertain" })}>Not sure</Button>
            {claim.userStatus !== "pending" && (
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  setText(claim.originalClaim);
                  onAction({ type: "restore" });
                }}
              >
                Reset
              </Button>
            )}
          </div>
        )}
      </div>

      {confirmKeep && (
        <div role="alertdialog" aria-labelledby={`keep-${claim.id}`} className="reveal mt-3 rounded-xl border border-coral/30 bg-coral-soft p-3">
          <p id={`keep-${claim.id}`} className="text-[14px] leading-relaxed">
            Bol could not find this in your original words. You can still keep it, but it will be clearly separated in the final version.
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
            <Button size="sm" variant="quiet" onClick={() => setConfirmKeep(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </article>
  );
}
