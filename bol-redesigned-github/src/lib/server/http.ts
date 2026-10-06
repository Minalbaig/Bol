import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SafeFailure, logFailure, toSafeFailure } from "./clients";

export const TranscriptBody = z.object({ transcript: z.string().trim().min(1).max(12000) });

export async function readTranscript(req: Request): Promise<string> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new SafeFailure("bad_request", "The request could not be read.", false, 400);
  }
  const parsed = TranscriptBody.safeParse(body);
  if (!parsed.success) {
    throw new SafeFailure("bad_request", "The transcript is empty or longer than 12,000 characters.", false, 400);
  }
  return parsed.data.transcript;
}

export function fail(stage: string, err: unknown) {
  const f = toSafeFailure(err);
  logFailure(stage, f);
  return NextResponse.json(f.toBody(), { status: f.status, headers: { "Cache-Control": "no-store" } });
}

export function ok<T>(data: T) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
