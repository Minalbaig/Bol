"use client";

import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import { initialState, reducer, type SessionEvent, type SessionState, type Step } from "@/lib/session";
import { getStatus } from "@/lib/clientApi";
import { Button, ConfirmDialog } from "./ui";
import { IntroScreen } from "./IntroScreen";
import { InputScreen } from "./InputScreen";
import { TranscriptScreen } from "./TranscriptScreen";
import { CompareScreen } from "./CompareScreen";
import { NarrativeScreen } from "./NarrativeScreen";
import { DemoControls } from "./DemoControls";

export interface ServiceStatus {
  anthropic: boolean;
  openai: boolean;
  models: Record<string, string>;
}

interface Ctx {
  state: SessionState;
  dispatch: Dispatch<SessionEvent>;
  status: ServiceStatus | null;
  requestDelete: () => void;
}

const SessionContext = createContext<Ctx | null>(null);

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside provider");
  return ctx;
}

const STEPS: { id: Step; label: string }[] = [
  { id: "intro", label: "Before you begin" },
  { id: "input", label: "Add an account" },
  { id: "transcript", label: "Review transcript" },
  { id: "compare", label: "Compare and review" },
  { id: "narrative", label: "Your narrative" },
];

export function BolApp() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState("fixture"));
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const firstStep = useRef(true);

  useEffect(() => {
    let cancelled = false;
    getStatus().then((s) => {
      if (cancelled || !s) return;
      setStatus(s);
      // Live by default only when the server is configured; otherwise precomputed.
      if (s.anthropic) dispatch({ type: "setMode", mode: "live" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Move focus to the new screen heading on step change, for keyboard and screen-reader users.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const h = mainRef.current?.querySelector("h1");
    if (h instanceof HTMLElement) {
      h.setAttribute("tabindex", "-1");
      h.focus();
    }
    window.scrollTo({ top: 0 });
  }, [state.step]);

  const stepIndex = STEPS.findIndex((s) => s.id === state.step);

  const doDelete = () => {
    dispatch({ type: "deleteSession" });
    setConfirmDelete(false);
    setAnnouncement("Session deleted. Everything you added has been cleared from this page.");
  };

  return (
    <SessionContext.Provider value={{ state, dispatch, status, requestDelete: () => setConfirmDelete(true) }}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="no-print border-b border-line bg-paper/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-[28px] font-bold leading-none tracking-[-0.03em] text-ink">Bol</span>
            <span className="hidden text-sm text-muted sm:inline">An evidence-preserving AI interface for sensitive narratives</span>
          </div>
          <div className="flex items-center gap-2">
            {state.research.enabled && (
              <span className="rounded-full border border-lav/40 bg-lav-soft px-2.5 py-1 text-[13px] font-semibold text-lav">
                Research mode
              </span>
            )}
            {state.step !== "intro" && (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete session
              </Button>
            )}
          </div>
        </div>
        <nav aria-label="Progress" className="mx-auto max-w-6xl px-5 pb-3">
          <ol className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
            {STEPS.map((s, i) => (
              <li
                key={s.id}
                aria-current={i === stepIndex ? "step" : undefined}
                className={i === stepIndex ? "font-semibold text-ink" : i < stepIndex ? "text-slate" : "text-muted"}
              >
                <span className="tabular-nums">{i + 1}.</span> {s.label}
                {i < stepIndex && <span className="sr-only"> (done)</span>}
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <main id="main" ref={mainRef} className="mx-auto max-w-6xl px-5 pb-28 pt-8">
        {state.step === "intro" && <IntroScreen />}
        {state.step === "input" && <InputScreen />}
        {state.step === "transcript" && <TranscriptScreen />}
        {state.step === "compare" && <CompareScreen />}
        {state.step === "narrative" && <NarrativeScreen />}
      </main>

      <footer className="no-print mx-auto max-w-6xl px-5 pb-10 text-[13px] text-muted">
        Bol is an HCI research prototype. It organizes what you provide; it does not verify what happened and is not a legal,
        medical, psychological or emergency service.
      </footer>

      <DemoControls />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this session?"
        body="This clears the transcript, summaries, claims, your decisions and any research measures from this page. It cannot be undone."
        confirmLabel="Delete session"
        destructive
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </SessionContext.Provider>
  );
}
