/**
 * Scribl POC — Claude provider-abstraction public surface.
 *
 * Feature code imports only from here (or `@scribl/provider/*`). It never
 * imports an adapter file or the Anthropic SDK directly (ADR 0009, AC8).
 */

export type {
  ClaudeOperation,
  DescribeImageRequest,
  DescribeImageResponse,
  GenerateRequest,
  GenerateResponse,
  ModerateRequest,
  ModerateResponse,
  ModerationVerdict,
  ProviderAdapter,
  ProviderConfig,
  ProviderKind,
  TokenLogEntry,
  TokenLogger,
  TokenUsage,
} from "./types";

export { MODEL_TIERS, modelForOperation } from "./model-tiers";
export type { ModelTierKey } from "./model-tiers";

export { consoleTokenLogger, noopTokenLogger } from "./logger";

export {
  createProviderAdapter,
  providerConfigFromEnv,
  DEFAULT_PROVIDER_CONFIG,
} from "./factory";
