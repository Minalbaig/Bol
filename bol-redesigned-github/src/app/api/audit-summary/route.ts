import { z } from "zod";
import type { SummaryAuditResult } from "@/lib/schema";
import { assembleAudit, splitStatements } from "@/lib/pipeline";
import { runSummaryAudit } from "@/lib/server/stages";
import { SafeFailure } from "@/lib/server/clients";
import { fail, ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  transcript: z.string().trim().min(1).max(12000),
  summary: z.string().trim().min(1).max(4000),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new SafeFailure("bad_request", "The transcript or summary is missing.", false, 400);
    const { transcript, summary } = parsed.data;
    const statements = splitStatements(summary);
    const t0 = Date.now();
    const audit = await runSummaryAudit(transcript, statements);
    const result: SummaryAuditResult = {
      statements: assembleAudit(transcript, statements, audit),
      origin: "live",
      ms: Date.now() - t0,
    };
    return ok(result);
  } catch (err) {
    return fail("summary_audit", err);
  }
}
