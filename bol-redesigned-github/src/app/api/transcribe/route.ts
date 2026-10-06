import { toFile } from "openai";
import { config, getOpenAI, hasOpenAI, SafeFailure } from "@/lib/server/clients";
import { fail, ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Speech to text. The audio is held in memory only for the duration of this
 * request and is never written to disk or logged.
 */
export async function POST(req: Request) {
  try {
    if (!hasOpenAI()) {
      throw new SafeFailure("not_configured", "Transcription is not configured on this server. Type the account instead, or load a demonstration.", false, 503);
    }
    const form = await req.formData().catch(() => null);
    const file = form?.get("audio");
    if (!(file instanceof File) || file.size === 0) {
      throw new SafeFailure("bad_request", "No audio was received.", false, 400);
    }
    if (file.size > MAX_BYTES) {
      throw new SafeFailure("too_large", "The audio file is larger than 25 MB. Try a shorter recording.", false, 413);
    }
    if (file.type && !file.type.startsWith("audio/") && !file.type.startsWith("video/webm")) {
      throw new SafeFailure("bad_type", "That file does not look like audio.", false, 415);
    }

    const upload = await toFile(Buffer.from(await file.arrayBuffer()), file.name || "recording.webm", {
      type: file.type || "audio/webm",
    });
    const result = await getOpenAI().audio.transcriptions.create({
      file: upload,
      model: config.transcriptionModel,
      // No language is forced, so mixed English, Urdu and Roman Urdu are allowed.
      prompt:
        "The speaker may switch between English, Urdu and Roman Urdu in the same sentence. Transcribe exactly what is said, keep hesitations such as 'around' or 'maybe', and do not translate.",
    });
    return ok({ transcript: result.text.trim() });
  } catch (err) {
    return fail("transcription", err);
  }
}
