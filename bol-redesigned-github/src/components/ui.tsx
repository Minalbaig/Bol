"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { EvidenceType, UserStatus } from "@/lib/schema";

type Variant = "primary" | "secondary" | "quiet" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-blue text-white shadow-sm hover:bg-[#394bac] disabled:bg-[#aab3d6] disabled:shadow-none",
  secondary: "bg-surface text-ink border border-line hover:border-blue/50 hover:bg-blue-soft/35 disabled:text-muted",
  quiet: "text-blue hover:bg-blue-soft disabled:text-muted",
  danger: "bg-surface text-danger border border-[#e7b4ae] hover:bg-danger-soft",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  const sizing = size === "sm" ? "px-3 py-2 text-sm" : "px-4 py-3 text-[15px]";
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export const EVIDENCE_META: Record<EvidenceType, { label: string; long: string; className: string }> = {
  direct: { label: "Direct", long: "Stated directly in the source", className: "bg-blue-soft text-blue border-blue/30" },
  approximate: {
    label: "Approximate",
    long: "Supported, with approximate or uncertain wording kept",
    className: "bg-amber-soft text-amber border-amber/30",
  },
  unsupported: {
    label: "Unsupported",
    long: "Not supported by the cited words",
    className: "bg-coral-soft text-coral border-dashed border-coral/45",
  },
  unknown: { label: "Cannot determine", long: "Support could not be determined", className: "bg-stone-soft text-[#3f4553] border-[#9ca3af]" },
};

function EvidenceIcon({ type }: { type: EvidenceType }) {
  const common = { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": true } as const;
  switch (type) {
    case "direct":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5.5" fill="currentColor" />
        </svg>
      );
    case "approximate":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 2 A5 5 0 0 1 7 12 Z" fill="currentColor" />
        </svg>
      );
    case "unsupported":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3.5 10.5 L10.5 3.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "unknown":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2" />
        </svg>
      );
  }
}

export function EvidenceBadge({ type }: { type: EvidenceType }) {
  const m = EVIDENCE_META[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold ${m.className}`}
      title={m.long}
    >
      <EvidenceIcon type={type} />
      {m.label}
      <span className="sr-only">: {m.long}</span>
    </span>
  );
}

export const STATUS_LABEL: Record<UserStatus, string> = {
  pending: "Not reviewed yet",
  accepted: "Accepted",
  edited: "Edited by you",
  rejected: "Rejected",
  uncertain: "Marked uncertain",
};

export function FixtureLabel({ className = "" }: { className?: string }) {
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-full border border-lav/20 bg-lav-soft px-3 py-1 text-[12px] font-semibold text-lav ${className}`}
      role="note"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3.5 6h5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      Fictional demo · precomputed
    </p>
  );
}

export function ErrorNotice({ message, onRetry, extra }: { message: string; onRetry?: () => void; extra?: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-[#e7b4ae] bg-danger-soft p-4 text-[15px] text-[#7a1a12]">
      <p className="font-semibold">That step did not complete</p>
      <p className="mt-1">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        {extra}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-[15px] text-slate">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="motion-safe:animate-spin">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      {label}
    </p>
  );
}

/** Accessible confirmation dialog built on the native <dialog> element. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,440px)] rounded-xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-[#1f2532]/40"
    >
      <h2 id="confirm-title" className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-2 text-[15px] text-slate">{body}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
