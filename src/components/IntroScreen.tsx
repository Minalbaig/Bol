"use client";

import { useState } from "react";
import { useSession } from "./BolApp";
import { Button } from "./ui";

export function IntroScreen() {
  const { state, dispatch } = useSession();
  const [showResearch, setShowResearch] = useState(state.research.enabled);
  const r = state.research;

  const canStart = state.consented && (!r.enabled || r.consented);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr]">
      <section aria-labelledby="intro-title">
        <h1 id="intro-title" className="max-w-[16ch] text-[40px] font-bold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[52px]">
          Organize the story without taking ownership of it.
        </h1>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-slate">
          Bol helps you turn an account, in your own words and in any mix of English, Urdu and Roman Urdu, into a structured
          narrative. Every statement Bol makes stays linked to the exact words it came from, so you can check it, change it or
          remove it.
        </p>

        <div className="mt-8 max-w-[62ch] space-y-4 text-[16px] leading-relaxed text-ink">
          <h2 className="text-[15px] font-semibold text-slate">How this prototype handles what you share</h2>
          <ul className="space-y-3">
            <li>
              <strong className="font-semibold">Bol organizes; it does not verify.</strong> It cannot tell whether something
              happened and never judges whether an account is true.
            </li>
            <li>
              <strong className="font-semibold">It is not a legal, medical, psychological or emergency service.</strong> If you
              are in danger, contact local emergency services or someone you trust.
            </li>
            <li>
              <strong className="font-semibold">You control what is kept.</strong> Nothing is analysed until you confirm the
              transcript, and nothing enters your narrative unless you approve it.
            </li>
            <li>
              <strong className="font-semibold">Nothing is stored permanently.</strong> Your session exists only in this browser
              tab. Text you confirm is sent to AI services for processing and is not saved by Bol.
            </li>
            <li>
              <strong className="font-semibold">You can leave at any time.</strong> Close the tab or use Delete session.
            </li>
          </ul>
        </div>

        <div className="mt-8 rounded-xl border border-line bg-surface p-5">
          <label className="flex cursor-pointer items-start gap-3 text-[16px]">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-[#2f5585]"
              checked={state.consented}
              onChange={(e) => dispatch({ type: "consent", value: e.target.checked })}
            />
            <span>I understand how this prototype will process the information I provide.</span>
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={!canStart} onClick={() => dispatch({ type: "goto", step: "input" })}>
              Continue
            </Button>
            {!state.consented && <span className="text-sm text-muted">Tick the box above to continue.</span>}
            {state.consented && r.enabled && !r.consented && (
              <span className="text-sm text-muted">Complete the study consent, or turn research mode off.</span>
            )}
          </div>
        </div>
      </section>

      <aside aria-labelledby="rq-title" className="space-y-6 lg:pt-3">
        <div className="rounded-xl border border-line bg-mist p-5">
          <h2 id="rq-title" className="text-[15px] font-semibold text-slate">
            Research question
          </h2>
          <p className="mt-2 text-[17px] leading-relaxed text-ink">
            How does evidence-linked AI summarization affect user trust, correction behaviour and perceived control when people
            review sensitive multilingual narratives?
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-slate">
            Bol is studying trust calibration, not maximum trust. A good outcome is that you can see where the AI stayed close to
            your words, where it was approximate, and where it went beyond them.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-[#5b4c9e]"
              checked={showResearch}
              onChange={(e) => {
                setShowResearch(e.target.checked);
                dispatch({ type: "research", patch: { enabled: e.target.checked, consented: false } });
              }}
            />
            <span>
              <span className="font-semibold">Use research mode</span>
              <span className="block text-sm text-slate">For facilitated study sessions only.</span>
            </span>
          </label>

          {showResearch && (
            <div className="reveal mt-4 space-y-3 border-t border-line pt-4 text-[14px] leading-relaxed text-ink">
              <h3 className="font-semibold">Study information and consent</h3>
              <p>
                This session compares two ways of reviewing AI output. With your consent, Bol records counts of your decisions,
                how long the review took, how often you opened source evidence, and your answers to five short ratings.
              </p>
              <p>
                <strong className="font-semibold">Bol does not record what you say.</strong> No narrative text, transcript or
                claim wording is included in the measures. They stay in this browser tab until the facilitator exports them, and
                Delete session clears them.
              </p>
              <p>
                The ratings are prototype measures, not a validated psychological instrument. Taking part is voluntary and you can
                stop at any time without giving a reason.
              </p>
              <label className="block">
                <span className="text-sm font-semibold">Participant code (optional, never a name)</span>
                <input
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2"
                  value={r.participantCode}
                  maxLength={24}
                  onChange={(e) =>
                    dispatch({ type: "research", patch: { participantCode: e.target.value.replace(/[^\w-]/g, "") } })
                  }
                  placeholder="P07"
                />
              </label>
              <fieldset>
                <legend className="text-sm font-semibold">Condition (set by the facilitator)</legend>
                <div className="mt-1 flex flex-wrap gap-4">
                  {(
                    [
                      ["baseline", "Baseline summary interface"],
                      ["bol", "Bol interface"],
                    ] as const
                  ).map(([v, label]) => (
                    <label key={v} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="condition"
                        className="accent-[#5b4c9e]"
                        checked={r.condition === v}
                        onChange={() => dispatch({ type: "research", patch: { condition: v } })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex cursor-pointer items-start gap-3 rounded-md bg-lav-soft p-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-[#5b4c9e]"
                  checked={r.consented}
                  onChange={(e) => dispatch({ type: "research", patch: { consented: e.target.checked } })}
                />
                <span>I have read the study information and agree to take part.</span>
              </label>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
