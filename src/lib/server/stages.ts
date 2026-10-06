import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import {
  CLAIM_CATEGORIES,
  EVIDENCE_TYPES,
  ExtractionOutputSchema,
  NOT_INFERRED_KINDS,
  SummaryAuditOutputSchema,
  SummaryOutputSchema,
  VerificationOutputSchema,
  type ExtractionOutput,
  type SummaryAuditOutput,
  type VerificationOutput,
} from "../schema";
import { asData, callClaudeTool, config } from "./clients";
import { BASELINE_SUMMARY_PROMPT, EXTRACTION_PROMPT, SUMMARY_AUDIT_PROMPT, VERIFICATION_PROMPT } from "./prompts";

type Schema = Anthropic.Tool.InputSchema;
const str = { type: "string" };

const SUMMARY_TOOL: Schema = {
  type: "object",
  properties: { summary: str },
  required: ["summary"],
};

const EXTRACTION_TOOL: Schema = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "c1, c2, ..." },
          claim: str,
          category: { type: "string", enum: [...CLAIM_CATEGORIES] },
          sourceExcerpt: { type: "string", description: "Exact words copied from the account" },
          evidenceType: { type: "string", enum: [...EVIDENCE_TYPES] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          uncertaintyMarkers: { type: "array", items: str },
          supportExplanation: str,
        },
        required: ["id", "claim", "category", "sourceExcerpt", "evidenceType", "confidence", "uncertaintyMarkers", "supportExplanation"],
      },
    },
    notInferred: {
      type: "array",
      items: {
        type: "object",
        properties: { kind: { type: "string", enum: [...NOT_INFERRED_KINDS] }, note: str, relatedExcerpt: str },
        required: ["kind", "note", "relatedExcerpt"],
      },
    },
    optionalQuestions: { type: "array", items: str },
  },
  required: ["claims", "notInferred", "optionalQuestions"],
};

const VERDICT_TOOL: Schema = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: { id: str, verdict: { type: "string", enum: [...EVIDENCE_TYPES] }, explanation: str },
        required: ["id", "verdict", "explanation"],
      },
    },
  },
  required: ["verdicts"],
};

const AUDIT_TOOL: Schema = {
  type: "object",
  properties: {
    statements: {
      type: "array",
      items: {
        type: "object",
        properties: { id: str, sourceExcerpt: str, verdict: { type: "string", enum: [...EVIDENCE_TYPES] }, explanation: str },
        required: ["id", "sourceExcerpt", "verdict", "explanation"],
      },
    },
  },
  required: ["statements"],
};

export async function runBaselineSummary(transcript: string): Promise<string> {
  const out = await callClaudeTool({
    model: config.summaryModel,
    system: BASELINE_SUMMARY_PROMPT,
    user: asData("Summarize this account.", transcript),
    toolName: "record_summary",
    toolDescription: "Record the summary.",
    inputSchema: SUMMARY_TOOL,
    schema: SummaryOutputSchema,
    maxTokens: 800,
  });
  return out.summary.trim();
}

export async function runExtraction(transcript: string): Promise<ExtractionOutput> {
  return callClaudeTool({
    model: config.extractionModel,
    system: EXTRACTION_PROMPT,
    user: asData("Extract atomic claims from this account.", transcript),
    toolName: "record_claims",
    toolDescription: "Record the extracted claims, what was not inferred and optional questions.",
    inputSchema: EXTRACTION_TOOL,
    schema: ExtractionOutputSchema,
  });
}

export async function runVerification(items: { id: string; claim: string; citedWords: string }[]): Promise<VerificationOutput> {
  if (items.length === 0) return { verdicts: [] };
  return callClaudeTool({
    model: config.verifierModel,
    system: VERIFICATION_PROMPT,
    user: `Check each claim against only its cited words.\n<items>\n${JSON.stringify(items, null, 1)}\n</items>`,
    toolName: "record_verdicts",
    toolDescription: "Record one verdict per item id.",
    inputSchema: VERDICT_TOOL,
    schema: VerificationOutputSchema,
  });
}

export async function runSummaryAudit(transcript: string, statements: { id: string; text: string }[]): Promise<SummaryAuditOutput> {
  return callClaudeTool({
    model: config.verifierModel,
    system: SUMMARY_AUDIT_PROMPT,
    user: `${asData("Original account:", transcript)}\n<statements>\n${JSON.stringify(statements, null, 1)}\n</statements>`,
    toolName: "record_audit",
    toolDescription: "Record one result per statement id.",
    inputSchema: AUDIT_TOOL,
    schema: SummaryAuditOutputSchema,
  });
}
