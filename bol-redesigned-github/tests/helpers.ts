import type { ExtractedClaim, ExtractionOutput } from "@/lib/schema";

export const TRANSCRIPT_A =
  "Kal around 6 baje main bus stop par thi. Ek aadmi kuch der se meri taraf dekh raha tha. Phir woh paas aya aur bola ke apna number do. Maine mana kiya aur thora door chali gayi. Woh dobara paas aya lekin jab bus aa gayi tou main bus mein chali gayi. Mujhe exact time yaad nahi lekin Maghrib se pehle tha. Mere paas bus ticket hai.";

export function claim(partial: Partial<ExtractedClaim> & Pick<ExtractedClaim, "id" | "claim" | "sourceExcerpt">): ExtractedClaim {
  return {
    category: "other",
    evidenceType: "direct",
    confidence: 0.9,
    uncertaintyMarkers: [],
    supportExplanation: "Stated directly.",
    ...partial,
  };
}

export function extraction(claims: ExtractedClaim[]): ExtractionOutput {
  return { claims, notInferred: [], optionalQuestions: [] };
}
