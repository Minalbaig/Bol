import { config, hasAnthropic, hasOpenAI } from "@/lib/server/clients";
import { ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Reports which services are configured. Never returns key values. */
export function GET() {
  return ok({
    anthropic: hasAnthropic(),
    openai: hasOpenAI(),
    models: {
      summary: config.summaryModel,
      extraction: config.extractionModel,
      verifier: config.verifierModel,
      transcription: config.transcriptionModel,
    },
  });
}
