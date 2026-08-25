/**
 * Scribl POC — stub image adapter (DEFAULT for POC/dev/CI).
 *
 * Deterministic solid-color background, no network calls. Keeps e2e/CI green
 * with no API key configured.
 */
import type { GenerateBackgroundRequest, GenerateBackgroundResult, ImageProvider } from "../types";

/**
 * A tiny, deterministic 1x1 solid-color PNG (base64), used as the stub
 * "generated" background. Not derived from any prompt; fixed for CI/e2e assertions.
 */
export const STUB_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAf/e/vDgAAAAASUVORK5CYII=";

export function createStubImageProvider(): ImageProvider {
  return {
    provider: "stub",
    async generateBackground(_req: GenerateBackgroundRequest): Promise<GenerateBackgroundResult> {
      return {
        imageBase64: STUB_IMAGE_BASE64,
        mimeType: "image/png",
        modelId: "stub",
      };
    },
  };
}
