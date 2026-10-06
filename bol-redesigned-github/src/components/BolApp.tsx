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

const STAGES = ["Tell it", "Review AI", "Your version"] as const;

function stageForStep(step: Step) {
  if (step === "intro" || step === "input") return 0;
  if (step === "transcript" || step === "compare") return 1;
  return 2;
}

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
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const currentStage = stageForStep(state.step);

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

      <header className="no-print border-b border-line/90 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue text-xl font-bold text-white shadow-sm" aria-hidden="true">
              B
            </span>
            <div>
              <p className="text-[19px] font-bold leading-none tracking-[-0.02em] text-ink">Bol</p>
              <p className="mt-1 hidden text-[12px] text-muted sm:block">Keep your words. See what AI changed.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {state.scenarioId && (
              <span className="hidden rounded-full border border-lav/20 bg-lav-soft px-3 py-1.5 text-[12px] font-semibold text-lav sm:inline-flex">
                Fictional demo
              </span>
            )}
            <DemoControls />
            {state.step !== "intro" && (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                Delete session
              </Button>
            )}
          </div>
        </div>

        <nav aria-label="Progress" className="mx-auto max-w-2xl px-5 pb-4">
          <ol className="grid grid-cols-3 gap-2">
            {STAGES.map((label, i) => (
              <li
                key={label}
                aria-current={i === currentStage ? "step" : undefined}
                className={`rounded-xl px-3 py-2 text-center text-[13px] font-semibold transition-colors ${
                  i === currentStage
                    ? "bg-blue-soft text-blue"
                    : i < currentStage
                      ? "text-blue"
                      : "text-muted"
                }`}
              >
                {i < currentStage && <span aria-hidden="true">✓ </span>}
                {label}
                {i < currentStage && <span className="sr-only"> (done)</span>}
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <main id="main" ref={mainRef} className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-7 sm:pt-10">
        {state.step === "intro" && <IntroScreen />}
        {state.step === "input" && <InputScreen />}
        {state.step === "transcript" && <TranscriptScreen />}
        {state.step === "compare" && <CompareScreen />}
        {state.step === "narrative" && <NarrativeScreen />}
      </main>

      <footer className="no-print mx-auto max-w-7xl border-t border-line/80 px-5 py-7 text-[12px] leading-relaxed text-muted sm:px-7">
        Bol is a human-centered AI prototype. It organizes what you provide; it does not verify events or provide legal,
        medical, psychological or emergency advice.
      </footer>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this session?"
        body="This clears the transcript, AI output and every choice you made on this page. It cannot be undone."
        confirmLabel="Delete session"
        destructive
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </SessionContext.Provider>
  );
}
