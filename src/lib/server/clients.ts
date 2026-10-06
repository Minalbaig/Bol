import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { ZodType } from "zod";
import type { SafeError } from "../schema";

const DEFAULT_MODEL = "claude-sonnet-5-5";

export const config = {
  summaryModel: process.env.ANTHROPIC_SUMMARY_MODEL || DEFAULT_MODEL,
  extractionModel: process.env.ANTHROPIC_EXTRACTION_MODEL || DEFAULT_MODEL,
  verifierModel: process.env.ANTHROPIC_VERIFIER_MODEL || DEFAULT_MODEL,
  transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-transcribe",
  timeoutMs: Number(process.env.BOL_REQUEST_TIMEOUT_MS) || 45000,
};

export function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

export function getAnthropic(): Anthropic {
  anthropic ??= new Anthropic({ timeout: config.timeoutMs, maxRetries: 1 });
  return anthropic;
}
export function getOpenAI(): OpenAI {
  openai ??= new OpenAI({ timeout: config.timeoutMs, maxRetries: 1 });
  return openai;
}

/** A failure that is safe to show. It never contains request content. */
export class SafeFailure extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public retryable: boolean,
    public status = 502,
  ) {
    super(code);
  }
  toBody(): SafeError {
    return { error: { code: this.code, message: this.userMessage, retryable: this.retryable } };
  }
}

export function toSafeFailure(err: unknown): SafeFailure {
  if (err instanceof SafeFailure) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof OpenAI.AuthenticationError) {
    return new SafeFailure("auth", "The AI service rejected the server's credentials. Check the API key configuration.", false, 502);
  }
  if (err instanceof Anthropic.RateLimitError || err instanceof OpenAI.RateLimitError) {
    return new SafeFailure("rate_limited", "The AI service is busy. Wait a moment and try again.", true, 503);
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError || err instanceof OpenAI.APIConnectionTimeoutError) {
    return new SafeFailure("timeout", "The AI service took too long to respond. Try again or use the precomputed demonstration.", true, 504);
  }
  if (err instanceof Anthropic.APIConnectionError || err instanceof OpenAI.APIConnectionError) {
    return new SafeFailure("network", "The server could not reach the AI service. Check the connection and try again.", true, 503);
  }
  if (err instanceof Anthropic.NotFoundError || err instanceof OpenAI.NotFoundError) {
    return new SafeFailure("model_not_found", "The configured model name was not recognised. Check the model environment variables.", false, 502);
  }
  return new SafeFailure("unavailable", "The AI service is unavailable right now. Try again or use the precomputed demonstration.", true, 502);
}

/** Log only a code. Never log narrative content, prompts or responses. */
export function logFailure(stage: string, f: SafeFailure): void {
  console.warn(`[bol] ${stage} failed: ${f.code}`);
}

/**
 * Call Claude with a single forced tool, then validate the tool input with Zod.
 * One retry on malformed output; after that, fail safely.
 */
export async function callClaudeTool<T>(opts: {
  model: string;
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Anthropic.Tool.InputSchema;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  if (!hasAnthropic()) {
    throw new SafeFailure("not_configured", "Live analysis is not configured on this server. Use the precomputed demonstration.", false, 503);
  }
  const client = getAnthropic();
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: 0,
      system: opts.system,
      tools: [{ name: opts.toolName, description: opts.toolDescription, input_schema: opts.inputSchema }],
      tool_choice: { type: "tool", name: opts.toolName },
      messages: [{ role: "user", content: opts.user }],
    });
    const block = message.content.find((b) => b.type === "tool_use" && b.name === opts.toolName);
    if (block && block.type === "tool_use") {
      const parsed = opts.schema.safeParse(block.input);
      if (parsed.success) return parsed.data;
    }
  }
  throw new SafeFailure("malformed_output", "The AI returned a result Bol could not validate, so nothing was shown. Try again.", true, 502);
}

/** Wrap the account so the model treats it strictly as data. */
export function asData(label: string, text: string): string {
  const safe = text.replaceAll("</account>", "<\\/account>");
  return `${label}\n<account>\n${safe}\n</account>`;
}
