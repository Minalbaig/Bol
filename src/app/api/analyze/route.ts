import type { AnalysisResult } from "@/lib/schema";
import { assembleClaims, assembleNotAssumed, filterQuestions } from "@/lib/pipeline";
import { validateSource } from "@/lib/sourceValidation";
import { runExtraction, runVerification } from "@/lib/server/stages";
import { fail, ok, readTranscript } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const transcript = await readTranscript(req);

    // Stage 4: structured extraction
    const t0 = Date.now();
    const extraction = await runExtraction(transcript);
    const extractionMs = Date.now() - t0;

    // Stage 5: deterministic validation decides which words the verifier sees.
    // An invented excerpt is passed as empty, so it cannot lend support.
    const items = extraction.claims.map((c) => ({
      id: c.id,
      claim: c.claim,
      citedWords: validateSource(transcript, c.sourceExcerpt).matchedText ?? "",
    }));

    // Stage 6: independent verification
    const t1 = Date.now();
    const verification = await runVerification(items);
    const verificationMs = Date.now() - t1;

    const result: AnalysisResult = {
      claims: assembleClaims(transcript, extraction, verification),
      notInferred: assembleNotAssumed(transcript, extraction.notInferred),
      optionalQuestions: filterQuestions(extraction.optionalQuestions),
      timings: { extractionMs, verificationMs },
      origin: "live",
    };
    return ok(result);
  } catch (err) {
    return fail("analysis", err);
  }
}
