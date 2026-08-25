/**
 * Scribl POC — transcription adapter factory.
 *
 * `createTranscriptionProvider(config)` is the ONLY place that branches on
 * provider kind. A cloud provider requested without an API key is a
 * misconfiguration, not a soft-fallback case — it throws so a missing key
 * can't silently masquerade as fake (stub) captions.
 */
import { createStubTranscriptionAdapter } from "./adapters/stub";
import { createCloudTranscriptionAdapter } from "./adapters/cloud";
import type { TranscriptionConfig, TranscriptionProvider } from "./types";

export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionConfig = { provider: "stub" };

export function createTranscriptionProvider(
  config: TranscriptionConfig = DEFAULT_TRANSCRIPTION_CONFIG,
): TranscriptionProvider {
  if (config.provider === "cloud") {
    if (!config.apiKey) {
      throw new Error(
        "STT_PROVIDER=cloud requires STT_API_KEY or OPENAI_API_KEY to be set",
      );
    }
    return createCloudTranscriptionAdapter(config);
  }
  return createStubTranscriptionAdapter();
}

/**
 * Reads STT_PROVIDER (default "stub"), STT_API_KEY / OPENAI_API_KEY, and
 * STT_MODEL from env. Config-only swap: no app-code change required.
 */
export function transcriptionConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): TranscriptionConfig {
  const provider = (env.STT_PROVIDER ?? "stub") as TranscriptionConfig["provider"];
  const apiKey = env.STT_API_KEY ?? env.OPENAI_API_KEY;
  return { provider, apiKey, model: env.STT_MODEL };
}
