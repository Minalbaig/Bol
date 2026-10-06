import type { AnalysisResult, SafeError, SummaryAuditResult, SummaryResult } from "./schema";
import { findFixtureForTranscript, fixtureAnalysis, fixtureAudit, fixtureSummary } from "./fixtures";
import type { DataMode } from "./session";

export type ApiOutcome<T> = { ok: true; data: T } | { ok: false; error: SafeError["error"] };

export interface CallOptions {
  mode: DataMode;
  simulateFailure: boolean;
}

const SIMULATED: SafeError["error"] = {
  code: "simulated_failure",
  message: "Simulated failure from Demo controls. No request was sent. Try again, or switch to precomputed output.",
  retryable: true,
};

const NO_FIXTURE: SafeError["error"] = {
  code: "no_fixture",
  message:
    "Precomputed output only exists for the unedited demonstration transcripts. Switch Demo controls to live APIs, or reload the demonstration.",
  retryable: false,
};

const OFFLINE: SafeError["error"] = {
  code: "network",
  message: "Bol could not reach its server. Check the connection, or use the precomputed demonstration.",
  retryable: true,
};

async function post<T>(url: string, body: unknown): Promise<ApiOutcome<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as (T & Partial<SafeError>) | null;
    if (!res.ok || !json) {
      return { ok: false, error: json?.error ?? { code: "unavailable", message: "The request did not complete. Try again.", retryable: true } };
    }
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

/** Small pause so precomputed output is visibly a separate step, not instant magic. */
const settle = () => new Promise((r) => setTimeout(r, 450));

export async function getSummary(transcript: string, o: CallOptions): Promise<ApiOutcome<SummaryResult>> {
  if (o.simulateFailure) return { ok: false, error: SIMULATED };
  if (o.mode === "fixture") {
    const s = findFixtureForTranscript(transcript);
    await settle();
    return s ? { ok: true, data: fixtureSummary(s) } : { ok: false, error: NO_FIXTURE };
  }
  return post<SummaryResult>("/api/summarize", { transcript });
}

export async function getAnalysis(transcript: string, o: CallOptions): Promise<ApiOutcome<AnalysisResult>> {
  if (o.simulateFailure) return { ok: false, error: SIMULATED };
  if (o.mode === "fixture") {
    const s = findFixtureForTranscript(transcript);
    await settle();
    return s ? { ok: true, data: fixtureAnalysis(s) } : { ok: false, error: NO_FIXTURE };
  }
  return post<AnalysisResult>("/api/analyze", { transcript });
}

export async function getAudit(transcript: string, summary: string, o: CallOptions): Promise<ApiOutcome<SummaryAuditResult>> {
  if (o.simulateFailure) return { ok: false, error: SIMULATED };
  if (o.mode === "fixture") {
    const s = findFixtureForTranscript(transcript);
    await settle();
    if (!s) return { ok: false, error: NO_FIXTURE };
    if (summary.trim() !== s.summary.trim()) {
      return {
        ok: false,
        error: {
          code: "no_fixture",
          message: "The summary was edited, so the precomputed check no longer applies. Switch to live APIs to check the edited summary.",
          retryable: false,
        },
      };
    }
    return { ok: true, data: fixtureAudit(s) };
  }
  return post<SummaryAuditResult>("/api/audit-summary", { transcript, summary });
}

export async function transcribeAudio(blob: Blob, filename: string, simulateFailure: boolean): Promise<ApiOutcome<{ transcript: string }>> {
  if (simulateFailure) return { ok: false, error: SIMULATED };
  const form = new FormData();
  form.append("audio", blob, filename);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    const res = await fetch("/api/transcribe", { method: "POST", body: form, signal: controller.signal });
    clearTimeout(timer);
    const json = (await res.json().catch(() => null)) as ({ transcript: string } & Partial<SafeError>) | null;
    if (!res.ok || !json) {
      return { ok: false, error: json?.error ?? { code: "unavailable", message: "Transcription did not complete.", retryable: true } };
    }
    return { ok: true, data: json };
  } catch {
    return {
      ok: false,
      error: { code: "timeout", message: "Transcription took too long or the connection dropped. You can type the account instead.", retryable: true },
    };
  }
}

export async function getStatus(): Promise<{ anthropic: boolean; openai: boolean; models: Record<string, string> } | null> {
  try {
    const res = await fetch("/api/status", { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
