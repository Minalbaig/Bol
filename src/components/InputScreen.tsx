"use client";

import { useEffect, useRef, useState } from "react";
import { SCENARIOS } from "@/lib/fixtures";
import { transcribeAudio } from "@/lib/clientApi";
import type { InputSource } from "@/lib/session";
import { useSession } from "./BolApp";
import { Button, ErrorNotice, Spinner } from "./ui";

type Method = "record" | "upload" | "type" | "demo";

const METHODS: { id: Method; label: string; hint: string }[] = [
  { id: "record", label: "Record audio", hint: "Speak in any mix of languages" },
  { id: "upload", label: "Upload audio", hint: "An existing recording" },
  { id: "type", label: "Type an account", hint: "Write or paste text" },
  { id: "demo", label: "Load a fictional demonstration", hint: "No personal information" },
];

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function InputScreen() {
  const { state, dispatch, status } = useSession();
  const [method, setMethod] = useState<Method>("type");
  const [typed, setTyped] = useState(state.inputSource === "typed" ? state.transcript : "");

  const finish = (text: string, source: InputSource) => {
    dispatch({ type: "setTranscript", text, source });
    dispatch({ type: "goto", step: "transcript" });
  };

  return (
    <section aria-labelledby="input-title">
      <h1 id="input-title" className="text-[32px] font-bold tracking-[-0.02em]">
        Add an account
      </h1>
      <p className="mt-2 max-w-[62ch] text-[17px] text-slate">
        You can add as much or as little as you are comfortable providing. Nothing is analysed until you review and confirm the
        transcript on the next screen.
      </p>

      <div role="group" aria-label="Input method" className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={method === m.id}
            onClick={() => setMethod(m.id)}
            className={`rounded-xl border p-4 text-left ${
              method === m.id ? "border-blue bg-blue-soft" : "border-line bg-surface hover:border-slate"
            }`}
          >
            <span className="block font-semibold text-ink">{m.label}</span>
            <span className="mt-0.5 block text-sm text-slate">{m.hint}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface p-5 sm:p-6">
        {method === "record" && <Recorder onDone={(t) => finish(t, "recorded")} openaiReady={status?.openai ?? false} />}
        {method === "upload" && <Uploader onDone={(t) => finish(t, "uploaded")} openaiReady={status?.openai ?? false} />}
        {method === "type" && (
          <div>
            <label htmlFor="typed" className="font-semibold">
              Your account
            </label>
            <p id="typed-hint" className="mt-1 text-sm text-slate">
              Write it however it comes to you. Fragments, approximate times and &ldquo;I don&rsquo;t remember&rdquo; are all
              fine.
            </p>
            <textarea
              id="typed"
              aria-describedby="typed-hint"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              rows={8}
              maxLength={12000}
              className="mt-3 w-full rounded-lg border border-line bg-paper p-3 text-[16px] leading-relaxed"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm tabular-nums text-muted">{typed.length.toLocaleString()} / 12,000 characters</span>
              <Button variant="primary" disabled={!typed.trim()} onClick={() => finish(typed.trim(), "typed")}>
                Review transcript
              </Button>
            </div>
          </div>
        )}
        {method === "demo" && (
          <div>
            <p className="text-[15px] text-slate">
              These accounts are fictional. They let you see how Bol works without sharing anything personal.
            </p>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {SCENARIOS.map((s) => (
                <li key={s.id} className="rounded-lg border border-line p-4">
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-slate">{s.domain}</p>
                  <p className="mt-2 text-sm text-ink">{s.description}</p>
                  <Button className="mt-3" size="sm" onClick={() => dispatch({ type: "loadScenario", id: s.id, confirmed: false })}>
                    Load {s.title.toLowerCase()}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-6">
        <Button variant="quiet" onClick={() => dispatch({ type: "goto", step: "intro" })}>
          Back
        </Button>
      </div>
    </section>
  );
}

function useTranscription(onDone: (t: string) => void) {
  const { state } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (blob: Blob, name: string) => {
    setBusy(true);
    setError(null);
    const r = await transcribeAudio(blob, name, state.simulateFailure);
    setBusy(false);
    if (r.ok) {
      if (!r.data.transcript) setError("No speech was detected in the audio.");
      else onDone(r.data.transcript);
    } else setError(r.error.message);
  };
  return { busy, error, run, clearError: () => setError(null) };
}

function NotConfigured() {
  return (
    <p className="mb-4 rounded-md bg-mist p-3 text-sm text-slate">
      Transcription is not configured on this server. You can still record to try the controls, then type the account or load a
      fictional demonstration.
    </p>
  );
}

function Recorder({ onDone, openaiReady }: { onDone: (t: string) => void; openaiReady: boolean }) {
  const [phase, setPhase] = useState<"idle" | "requesting" | "recording" | "recorded">("idle");
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const { busy, error, run } = useTranscription((t) => {
    setBlob(null); // audio discarded after transcription
    onDone(t);
  });

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const start = async () => {
    setMicError(null);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError("This browser cannot record audio here. You can upload a file, type the account or load a demonstration.");
      return;
    }
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = () => {
        setBlob(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
        chunks.current = [];
        stream.getTracks().forEach((t) => t.stop());
        setPhase("recorded");
      };
      recRef.current = rec;
      setSeconds(0);
      rec.start();
      setPhase("recording");
    } catch {
      setPhase("idle");
      setMicError(
        "Microphone access was not available. You can allow it in your browser settings, or upload a file, type the account or load a demonstration instead.",
      );
    }
  };

  const stop = () => recRef.current?.stop();
  const discard = () => {
    setBlob(null);
    setSeconds(0);
    setPhase("idle");
  };

  return (
    <div>
      {!openaiReady && <NotConfigured />}
      <div className="flex flex-wrap items-center gap-4">
        {phase !== "recording" && phase !== "recorded" && (
          <Button variant="primary" onClick={start} disabled={phase === "requesting"}>
            {phase === "requesting" ? "Waiting for microphone…" : "Start recording"}
          </Button>
        )}
        {phase === "recording" && (
          <Button variant="primary" onClick={stop}>
            Stop recording
          </Button>
        )}
        <span className="text-[15px] tabular-nums text-slate" aria-live="off">
          {phase === "recording" && (
            <span className="mr-2 inline-flex items-center gap-1.5 font-semibold text-ink">
              <span className="h-2.5 w-2.5 rounded-full bg-blue motion-safe:animate-pulse" aria-hidden="true" /> Recording
            </span>
          )}
          Duration {formatDuration(seconds)}
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        {phase === "recording" ? "Recording started" : phase === "recorded" ? `Recording stopped at ${formatDuration(seconds)}` : ""}
      </p>
      {phase === "recorded" && blob && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={busy} onClick={() => run(blob, "recording.webm")}>
            Transcribe recording
          </Button>
          <Button variant="danger" disabled={busy} onClick={discard}>
            Delete recording
          </Button>
        </div>
      )}
      {busy && <div className="mt-4"><Spinner label="Transcribing. This can take up to a minute." /></div>}
      {micError && <p role="alert" className="mt-4 rounded-md bg-mist p-3 text-[15px] text-ink">{micError}</p>}
      {error && <div className="mt-4"><ErrorNotice message={error} onRetry={blob ? () => run(blob, "recording.webm") : undefined} /></div>}
      <p className="mt-4 text-sm text-muted">The recording stays in this tab until it is transcribed or deleted, and is then discarded.</p>
    </div>
  );
}

function Uploader({ onDone, openaiReady }: { onDone: (t: string) => void; openaiReady: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, error, run } = useTranscription((t) => {
    setFile(null);
    onDone(t);
  });
  return (
    <div>
      {!openaiReady && <NotConfigured />}
      <label htmlFor="audio-file" className="font-semibold">
        Audio file
      </label>
      <p id="audio-hint" className="mt-1 text-sm text-slate">MP3, M4A, WAV or WebM, up to 25 MB.</p>
      <input
        ref={inputRef}
        id="audio-file"
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg"
        aria-describedby="audio-hint"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mt-3 block w-full text-[15px] file:mr-3 file:rounded-md file:border file:border-line file:bg-paper file:px-3 file:py-2 file:font-semibold"
      />
      {file && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={busy} onClick={() => run(file, file.name)}>
            Transcribe file
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Remove file
          </Button>
        </div>
      )}
      {busy && <div className="mt-4"><Spinner label="Transcribing. This can take up to a minute." /></div>}
      {error && <div className="mt-4"><ErrorNotice message={error} onRetry={file ? () => run(file, file.name) : undefined} /></div>}
    </div>
  );
}
