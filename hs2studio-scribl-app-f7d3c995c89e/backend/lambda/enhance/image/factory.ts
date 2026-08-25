/**
 * Scribl POC — image adapter factory.
 *
 * `createImageProvider(config)` is the ONLY place that branches on provider
 * kind. If "openai" is requested but no API key is present, falls back to
 * the stub adapter (and warns once) so the operator's chosen default never
 * breaks CI/e2e.
 */
import { createStubImageProvider } from "./adapters/stub";
import { createOpenAiImageProvider } from "./adapters/openai";
import type { ImageConfig, ImageProvider } from "./types";

export const DEFAULT_IMAGE_CONFIG: ImageConfig = { provider: "stub" };

let warnedFallback = false;

export function createImageProvider(config: ImageConfig = DEFAULT_IMAGE_CONFIG): ImageProvider {
  if (config.provider === "openai") {
    if (config.apiKey) {
      // eslint-disable-next-line no-console
      console.log("enhance: image provider selected", { provider: "openai" });
      return createOpenAiImageProvider(config);
    }
    // Always log the fallback reason (not once-only) so it's visible on
    // every cold start / invocation that hits it — only the noisier
    // console.warn is throttled to once per process.
    // eslint-disable-next-line no-console
    console.log("enhance: image provider selected", {
      provider: "stub",
      reason: "IMAGE_PROVIDER=openai requested but no API key present",
    });
    if (!warnedFallback) {
      // eslint-disable-next-line no-console
      console.warn(
        "[enhance-image] IMAGE_PROVIDER=openai requested but no API key present; falling back to stub adapter",
      );
      warnedFallback = true;
    }
    return createStubImageProvider();
  }
  // eslint-disable-next-line no-console
  console.log("enhance: image provider selected", { provider: "stub" });
  return createStubImageProvider();
}

/**
 * Reads IMAGE_PROVIDER (default "stub"), IMAGE_API_KEY / OPENAI_API_KEY, and
 * IMAGE_MODEL from env. Config-only swap: no app-code change required.
 */
export function imageConfigFromEnv(env: Record<string, string | undefined> = process.env): ImageConfig {
  const provider = (env.IMAGE_PROVIDER ?? "stub") as ImageConfig["provider"];
  const apiKey = env.IMAGE_API_KEY ?? env.OPENAI_API_KEY;
  return { provider, apiKey, model: env.IMAGE_MODEL };
}
