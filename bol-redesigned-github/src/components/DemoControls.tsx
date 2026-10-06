"use client";

import { useEffect, useRef, useState } from "react";
import { SCENARIOS } from "@/lib/fixtures";
import { useSession } from "./BolApp";
import { Button } from "./ui";

export function DemoControls() {
  const { state, dispatch, status } = useSession();
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<string>(SCENARIOS[0]!.id);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const liveAvailable = status?.anthropic ?? false;

  return (
    <div className="relative">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls="demo-panel"
        onClick={() => setOpen(!open)}
        className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-slate transition-colors hover:border-blue/40 hover:text-blue"
      >
        Demo settings
      </button>

      {open && (
        <div
          ref={panelRef}
          id="demo-panel"
          role="region"
          aria-label="Demo settings"
          className="surface-shadow reveal absolute right-0 top-12 z-40 w-[min(88vw,350px)] rounded-2xl border border-line bg-surface p-5 text-[14px]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold">Presenter settings</h2>
              <p className="mt-0.5 text-[12px] text-muted">Keep the live demo reliable without exposing these controls in the main flow.</p>
            </div>
            <button className="text-sm font-semibold text-muted hover:text-ink" type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          <label className="mt-4 block">
            <span className="font-semibold">Fictional scenario</span>
            <select
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => dispatch({ type: "loadScenario", id: scenario, confirmed: false })}>
              Review words
            </Button>
            <Button size="sm" variant="primary" onClick={() => dispatch({ type: "loadScenario", id: scenario, confirmed: true })}>
              Open comparison
            </Button>
          </div>

          <fieldset className="mt-5 border-t border-line pt-4">
            <legend className="font-semibold">AI output</legend>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                className="accent-[#4659c7]"
                checked={state.mode === "live"}
                disabled={!liveAvailable}
                onChange={() => dispatch({ type: "setMode", mode: "live" })}
              />
              Live AI {!liveAvailable && <span className="text-muted">(not configured)</span>}
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                className="accent-[#4659c7]"
                checked={state.mode === "fixture"}
                onChange={() => dispatch({ type: "setMode", mode: "fixture" })}
              />
              Precomputed demo
            </label>
          </fieldset>

          <details className="mt-4 rounded-xl bg-mist p-3">
            <summary className="cursor-pointer font-semibold text-slate">Advanced demo options</summary>
            <label className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-[#4659c7]"
                checked={state.simulateFailure}
                onChange={(e) => dispatch({ type: "setSimulateFailure", value: e.target.checked })}
              />
              Simulate an API failure
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-[#4659c7]"
                checked={state.showTechnical}
                onChange={(e) => dispatch({ type: "setShowTechnical", value: e.target.checked })}
              />
              Show technical details
            </label>
          </details>

          <p className="mt-4 text-[12px] leading-relaxed text-muted">
            Claude: {status ? (status.anthropic ? "configured" : "not configured") : "checking"} · Transcription:{" "}
            {status ? (status.openai ? "configured" : "not configured") : "checking"}
          </p>

          <Button size="sm" variant="danger" className="mt-3 w-full" onClick={() => dispatch({ type: "deleteSession" })}>
            Reset complete experience
          </Button>
        </div>
      )}
    </div>
  );
}
