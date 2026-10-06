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
    panelRef.current?.querySelector<HTMLElement>("select, input, button")?.focus();
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
    <div className="no-print fixed bottom-24 right-3 z-40 sm:right-4 flex flex-col items-end gap-2">
      {open && (
        <div
          ref={panelRef}
          id="demo-panel"
          role="region"
          aria-label="Demo controls"
          className="reveal w-[min(92vw,340px)] rounded-xl border border-line bg-surface p-4 text-[14px] shadow-lg"
        >
          <h2 className="font-semibold">Demo controls</h2>
          <p className="text-[13px] text-slate">For presenters. Precomputed output is always labelled as such.</p>

          <label className="mt-3 block">
            <span className="font-semibold">Fictional scenario</span>
            <select
              className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1.5"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.domain})
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => dispatch({ type: "loadScenario", id: scenario, confirmed: false })}>
              Load for review
            </Button>
            <Button size="sm" variant="primary" onClick={() => dispatch({ type: "loadScenario", id: scenario, confirmed: true })}>
              Load confirmed transcript
            </Button>
          </div>

          <fieldset className="mt-4">
            <legend className="font-semibold">AI output</legend>
            <label className="mt-1 flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                className="accent-[#2f5585]"
                checked={state.mode === "live"}
                disabled={!liveAvailable}
                onChange={() => dispatch({ type: "setMode", mode: "live" })}
              />
              Use live APIs {!liveAvailable && <span className="text-slate">(not configured)</span>}
            </label>
            <label className="mt-1 flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                className="accent-[#2f5585]"
                checked={state.mode === "fixture"}
                onChange={() => dispatch({ type: "setMode", mode: "fixture" })}
              />
              Use precomputed demo fixtures
            </label>
          </fieldset>

          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-[#2f5585]"
              checked={state.simulateFailure}
              onChange={(e) => dispatch({ type: "setSimulateFailure", value: e.target.checked })}
            />
            Simulate an API failure
          </label>
          <label className="mt-1 flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-[#2f5585]"
              checked={state.showTechnical}
              onChange={(e) => dispatch({ type: "setShowTechnical", value: e.target.checked })}
            />
            Show technical details
          </label>

          <p className="mt-3 text-[13px] text-slate">
            Server: Claude {status ? (status.anthropic ? "configured" : "not configured") : "unknown"}; transcription{" "}
            {status ? (status.openai ? "configured" : "not configured") : "unknown"}.
          </p>

          <Button size="sm" variant="danger" className="mt-3 w-full" onClick={() => dispatch({ type: "deleteSession" })}>
            Reset complete experience
          </Button>
        </div>
      )}
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls="demo-panel"
        onClick={() => setOpen(!open)}
        className="rounded-full border border-line bg-surface/90 px-3 py-1.5 text-[13px] font-semibold text-slate shadow-sm hover:text-ink"
      >
        {open ? "Close demo controls" : "Demo"}
        {state.mode === "fixture" && !open && <span className="ml-1.5 text-[#5c4a12]">(precomputed)</span>}
      </button>
    </div>
  );
}
