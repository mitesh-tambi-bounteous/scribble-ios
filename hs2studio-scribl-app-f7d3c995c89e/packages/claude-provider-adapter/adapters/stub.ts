/**
 * Scribl POC — stub adapter (DEFAULT for POC/dev).
 *
 * Deterministic, seeded mock responses. No network calls, no SDK. Lets the
 * full loop (prompt generation, drawing caption, moderation) demo without
 * live inference, and gives the config-swap test a real second adapter to
 * flip to (AC8).
 */

import { modelForOperation } from "../model-tiers";
import type {
  DescribeImageRequest,
  DescribeImageResponse,
  GenerateRequest,
  GenerateResponse,
  ModerateRequest,
  ModerateResponse,
  ProviderAdapter,
  TokenLogger,
} from "../types";
import { noopTokenLogger } from "../logger";

const ZERO_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
} as const;

function fakeUsage(seedLen: number) {
  return {
    inputTokens: seedLen,
    outputTokens: Math.max(1, Math.round(seedLen / 4)),
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

export function createStubAdapter(log: TokenLogger = noopTokenLogger): ProviderAdapter {
  return {
    provider: "stub",

    async generate(req: GenerateRequest): Promise<GenerateResponse> {
      const modelId = modelForOperation("generate");
      const usage = fakeUsage(req.prompt.length);
      log({ operation: "generate", modelId, provider: "stub", usage, timestamp: new Date().toISOString() });
      return {
        text: `Stub daily prompt: draw something inspired by "${req.prompt.slice(0, 40)}".`,
        modelId,
        usage,
      };
    },

    async describeImage(req: DescribeImageRequest): Promise<DescribeImageResponse> {
      const modelId = modelForOperation("describeImage");
      const usage = fakeUsage(req.imageBase64.length > 0 ? 64 : 0);
      log({ operation: "describeImage", modelId, provider: "stub", usage, timestamp: new Date().toISOString() });
      return {
        caption: "Stub caption: a quick, charming sketch full of energy.",
        modelId,
        usage,
      };
    },

    async moderate(req: ModerateRequest): Promise<ModerateResponse> {
      const modelId = modelForOperation("moderate");
      const usage = req.text.length === 0 ? ZERO_USAGE : fakeUsage(req.text.length);
      log({ operation: "moderate", modelId, provider: "stub", usage, timestamp: new Date().toISOString() });
      return {
        verdict: "allow",
        modelId,
        usage,
      };
    },
  };
}
