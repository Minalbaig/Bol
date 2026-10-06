import { describe, expect, it } from "vitest";
import { normalizeText, validateSource } from "@/lib/sourceValidation";
import { TRANSCRIPT_A } from "./helpers";

describe("source validation", () => {
  it("finds an exact excerpt and records its range", () => {
    const m = validateSource(TRANSCRIPT_A, "Mere paas bus ticket hai");
    expect(m.status).toBe("exact");
    expect(TRANSCRIPT_A.slice(m.start!, m.end!)).toBe("Mere paas bus ticket hai");
  });

  it("matches after normalizing case, punctuation and whitespace", () => {
    const m = validateSource(TRANSCRIPT_A, "maine  MANA kiya,   aur thora door chali gayi");
    expect(m.status).toBe("normalized");
    expect(m.matchedText).toBe("Maine mana kiya aur thora door chali gayi");
  });

  it("normalizes curly quotes and Urdu punctuation", () => {
    expect(normalizeText("“Hello”—world۔")).toBe("hello world");
  });

  it("allows a close fuzzy match for a small transcription difference", () => {
    const m = validateSource(TRANSCRIPT_A, "Ek aadmi kuch der se meri taraf dekh rha tha");
    expect(m.status).toBe("fuzzy");
    expect(m.matchedText).toBe("Ek aadmi kuch der se meri taraf dekh raha tha");
  });

  it("rejects an invented excerpt", () => {
    const m = validateSource(TRANSCRIPT_A, "woh mujhe follow karta raha aur maine police ko bulaya");
    expect(m.status).toBe("not_found");
    expect(m.matchedText).toBeNull();
  });

  it("rejects short invented excerpts rather than fuzzy-matching them", () => {
    expect(validateSource(TRANSCRIPT_A, "main dar gayi").status).toBe("not_found");
    expect(validateSource(TRANSCRIPT_A, "").status).toBe("not_found");
  });

  it("never changes the original transcript", () => {
    const copy = `${TRANSCRIPT_A}`;
    validateSource(TRANSCRIPT_A, "MAINE MANA KIYA");
    validateSource(TRANSCRIPT_A, "Ek aadmi kuch der se meri taraf dekh rha tha");
    expect(TRANSCRIPT_A).toBe(copy);
  });

  it("works with Urdu script", () => {
    const t = "مجھے وقت یاد نہیں، لیکن مغرب سے پہلے تھا۔";
    expect(validateSource(t, "مغرب سے پہلے تھا").status).toBe("exact");
    expect(validateSource(t, "مجھے وقت یاد نہیں لیکن").status).toBe("normalized");
  });
});
