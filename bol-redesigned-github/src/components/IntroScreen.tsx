"use client";

import { useSession } from "./BolApp";
import { Button } from "./ui";

export function IntroScreen() {
  const { state, dispatch } = useSession();

  return (
    <div>
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <section aria-labelledby="intro-title">
          <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-blue">Human-centered AI prototype</p>
          <h1
            id="intro-title"
            className="mt-4 max-w-[12ch] text-[44px] font-bold leading-[1.02] tracking-[-0.045em] text-ink sm:text-[64px]"
          >
            Keep your words. See what AI changed.
          </h1>
          <p className="mt-6 max-w-[58ch] text-[18px] leading-relaxed text-slate">
            Tell an experience naturally in English, Urdu or Roman Urdu. Bol organizes it, links every AI suggestion back to
            your words and lets you decide what stays.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => dispatch({ type: "loadScenario", id: "bus-stop", confirmed: true })}>
              Try a fictional story
              <span aria-hidden="true">→</span>
            </Button>
            <Button disabled={!state.consented} onClick={() => dispatch({ type: "goto", step: "input" })}>
              Use my own words
            </Button>
          </div>

          <label className="mt-5 flex max-w-[620px] cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface/80 p-4 text-[14px] leading-relaxed text-slate">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#4659c7]"
              checked={state.consented}
              onChange={(e) => dispatch({ type: "consent", value: e.target.checked })}
            />
            <span>
              I understand that text I confirm may be sent to AI services for processing. Bol does not permanently store it in
              this prototype.
            </span>
          </label>
          {!state.consented && <p className="mt-2 text-[12px] text-muted">Consent is only needed when you use your own words.</p>}
        </section>

        <aside aria-label="How Bol keeps AI accountable" className="soft-shadow rounded-[28px] border border-line bg-surface p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">One sentence, made inspectable</p>
              <h2 className="mt-1 text-xl font-bold">What changed?</h2>
            </div>
            <span className="rounded-full bg-lav-soft px-3 py-1 text-[12px] font-semibold text-lav">Fictional example</span>
          </div>

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl bg-mist p-4">
              <p className="text-[12px] font-semibold text-muted">Original words</p>
              <p className="mt-2 text-[17px] leading-relaxed">“Main bus stop par thi.”</p>
            </div>
            <div className="flex justify-center text-blue" aria-hidden="true">↓</div>
            <div className="rounded-2xl border border-coral/25 bg-coral-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-coral">AI suggestion</p>
                <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-coral">Unsupported</span>
              </div>
              <p className="mt-2 text-[17px] leading-relaxed">“The person was waiting for a bus.”</p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate">Being at a bus stop does not prove they were waiting.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[12px] font-semibold">
              <span className="rounded-xl bg-blue-soft px-2 py-2 text-blue">Keep</span>
              <span className="rounded-xl bg-mist px-2 py-2 text-slate">Edit</span>
              <span className="rounded-xl bg-coral-soft px-2 py-2 text-coral">Remove</span>
            </div>
          </div>
        </aside>
      </div>

      <section aria-labelledby="how-title" className="mt-16 border-t border-line pt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-blue">A shorter flow</p>
            <h2 id="how-title" className="mt-2 text-[28px] font-bold tracking-[-0.025em]">Three steps. You stay in control.</h2>
          </div>
          <details className="max-w-xl text-[13px] text-slate">
            <summary className="cursor-pointer font-semibold text-blue">Why this is an HCI prototype</summary>
            <p className="mt-2 leading-relaxed">
              Bol explores whether showing source words, uncertainty and clear correction controls helps people review AI output
              more carefully. It does not decide whether an account is true.
            </p>
          </details>
        </div>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["01", "Tell it naturally", "Speak, type or upload. Mixed language and incomplete memories are allowed."],
            ["02", "Review the AI", "See direct, approximate and unsupported suggestions beside the original words."],
            ["03", "Keep your version", "Accept, edit or remove suggestions before creating the final narrative."],
          ].map(([number, title, body]) => (
            <li key={number} className="rounded-2xl border border-line bg-surface/80 p-5">
              <span className="text-[12px] font-bold text-blue">{number}</span>
              <h3 className="mt-3 text-[17px] font-bold">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-slate">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
