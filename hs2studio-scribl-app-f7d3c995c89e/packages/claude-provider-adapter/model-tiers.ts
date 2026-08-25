/**
 * Scribl POC — operation -> model-tier mapping (ADR 0011).
 *
 * Single home for model selection. Call sites never hardcode a model id;
 * they ask the seam for an operation and the seam resolves the tier.
 *
 *   generate      -> Opus tier   (daily prompt, once/day, quality-critical)
 *   describeImage -> Sonnet tier (vision; the differentiating feature)
 *   moderate      -> Haiku tier  (every submission; latency + cost sensitive)
 *
 * Model ids below are the confirmed Anthropic catalog ids (ADR 0011: Opus
 * 4.8, Sonnet 5 vision, Haiku 4.5). Bare first-party ids; the Bedrock
 * adapter applies the `anthropic.` prefix itself.
 */

import type { ClaudeOperation } from "./types";

export const MODEL_TIERS = {
  opus: "claude-opus-4-8",
  sonnetVision: "claude-sonnet-5",
  haiku: "claude-haiku-4-5",
} as const;

export type ModelTierKey = keyof typeof MODEL_TIERS;

/** operation -> tier key. The only place this mapping is declared. */
const OPERATION_TIER: Record<ClaudeOperation, ModelTierKey> = {
  generate: "opus",
  describeImage: "sonnetVision",
  moderate: "haiku",
};

/** Resolve the declared model id for a given operation (ADR 0011). */
export function modelForOperation(operation: ClaudeOperation): string {
  const tierKey = OPERATION_TIER[operation];
  const modelId = MODEL_TIERS[tierKey];
  if (!modelId) {
    throw new Error(`No model tier declared for operation: ${operation}`);
  }
  return modelId;
}
