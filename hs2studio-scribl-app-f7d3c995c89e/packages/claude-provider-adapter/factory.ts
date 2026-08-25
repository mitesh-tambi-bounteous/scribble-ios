/**
 * Scribl POC — adapter factory.
 *
 * `createProviderAdapter(config)` is the ONLY place that branches on
 * provider kind. Feature code calls this once at startup and then talks
 * only to the returned ProviderAdapter — swapping the configured provider
 * never requires an app-code change (AC8).
 */

import { createStubAdapter } from "./adapters/stub";
import { createDirectAdapter } from "./adapters/direct";
import { createBedrockAdapter } from "./adapters/bedrock";
import type { ProviderAdapter, ProviderConfig, TokenLogger } from "./types";
import { noopTokenLogger } from "./logger";

/** Default config: stub adapter, the POC/dev default per this story. */
export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = { provider: "stub" };

export function createProviderAdapter(
  config: ProviderConfig = DEFAULT_PROVIDER_CONFIG,
  log: TokenLogger = noopTokenLogger
): ProviderAdapter {
  switch (config.provider) {
    case "stub":
      return createStubAdapter(log);
    case "claude":
    case "direct":
      return createDirectAdapter(config, log);
    case "bedrock":
      return createBedrockAdapter(config, log);
    case "platform":
      throw new Error("platform adapter not implemented in POC (ADR 0009 seam reserved)");
    default: {
      // Exhaustiveness guard; assert the invariant rather than silently
      // falling through to an unconfigured adapter.
      const unreachable: never = config.provider;
      throw new Error(`Unknown provider config: ${String(unreachable)}`);
    }
  }
}

/** Reads CLAUDE_PROVIDER from env, defaulting to "stub". Config-only swap (AC8). */
export function providerConfigFromEnv(env: Record<string, string | undefined> = process.env): ProviderConfig {
  const provider = (env.CLAUDE_PROVIDER ?? "stub") as ProviderConfig["provider"];
  return { provider, apiKey: env.ANTHROPIC_API_KEY, region: env.AWS_REGION };
}
