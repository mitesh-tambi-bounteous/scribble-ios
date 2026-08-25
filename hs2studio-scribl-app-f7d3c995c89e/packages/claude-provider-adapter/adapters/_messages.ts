/**
 * Scribl POC — shared Messages-API request/response helpers (ADR 0009).
 *
 * Both live adapters (direct.ts, bedrock.ts) call `client.messages.create`
 * with the same body shape and need the same content -> text extraction,
 * usage mapping, and moderate structured-output parse + fail-safe verdict
 * normalization. Factored here to avoid duplication.
 *
 * IMPORTANT: no Anthropic SDK import belongs in this file. It only shapes
 * plain data the adapters pass to/from the SDK client they each construct.
 */

import type { ModerationVerdict, TokenUsage } from "../types";

const ALLOWED_VERDICTS: ReadonlySet<string> = new Set(["allow", "flag", "block"]);

/** JSON schema for the moderate structured-output response. */
export const MODERATE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["allow", "flag", "block"] },
    reason: { type: "string" },
  },
  required: ["verdict"],
  additionalProperties: false,
} as const;

/** A minimal shape covering both SDKs' content blocks (text blocks only matter here). */
export interface TextBearingBlock {
  type: string;
  text?: string;
}

/** Concatenate every text block's `text`, in order. Non-text blocks are skipped. */
export function extractText(content: readonly TextBearingBlock[] | undefined): string {
  if (!content || content.length === 0) {
    return "";
  }
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("");
}

/** A minimal shape covering both SDKs' `Usage` (nullable cache fields). */
export interface RawUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Map the SDK's usage shape into the seam's TokenUsage (ADR 0009 cost view). */
export function toTokenUsage(usage: RawUsage): TokenUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Parse the moderate structured-output JSON text into a verdict/reason.
 * Unparseable or unexpected shapes fail SAFE to "flag" (never silently
 * allow content the model failed to classify cleanly).
 */
export function parseModerationVerdict(rawText: string): { verdict: ModerationVerdict; reason?: string } {
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "verdict" in parsed &&
      typeof (parsed as { verdict: unknown }).verdict === "string" &&
      ALLOWED_VERDICTS.has((parsed as { verdict: string }).verdict)
    ) {
      const verdict = (parsed as { verdict: string }).verdict as ModerationVerdict;
      const reasonRaw = (parsed as { reason?: unknown }).reason;
      const reason = typeof reasonRaw === "string" ? reasonRaw : undefined;
      return reason === undefined ? { verdict } : { verdict, reason };
    }
  } catch {
    // fall through to fail-safe below
  }
  return { verdict: "flag", reason: "moderation response was unparseable or malformed; failing safe" };
}
