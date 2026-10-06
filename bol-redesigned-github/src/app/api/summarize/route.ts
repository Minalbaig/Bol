import type { SummaryResult } from "@/lib/schema";
import { runBaselineSummary } from "@/lib/server/stages";
import { fail, ok, readTranscript } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const transcript = await readTranscript(req);
    const t0 = Date.now();
    const summary = await runBaselineSummary(transcript);
    const result: SummaryResult = { summary, origin: "live", ms: Date.now() - t0 };
    return ok(result);
  } catch (err) {
    return fail("summary", err);
  }
}
