/**
 * Scribl POC — OpenAI image-generation adapter.
 *
 * Minimal POC seam: posts a TEXT-ONLY prompt to the OpenAI images/generations
 * endpoint (no image input, ever — data boundary). Only constructed by the
 * factory when a real API key is present (factory falls back to stub
 * otherwise). No secrets are hardcoded or logged here.
 */
import type { GenerateBackgroundRequest, GenerateBackgroundResult, ImageConfig, ImageProvider } from "../types";

const DEFAULT_MODEL = "gpt-image-1";
const DEFAULT_SIZE = "1024x1024";
const ENDPOINT = "https://api.openai.com/v1/images/generations";

export function createOpenAiImageProvider(config: ImageConfig): ImageProvider {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error("createOpenAiImageProvider requires an apiKey (guard in factory)");
  }
  const model = config.model ?? DEFAULT_MODEL;

  return {
    provider: "openai",

    async generateBackground(req: GenerateBackgroundRequest): Promise<GenerateBackgroundResult> {
      const size = req.size ?? DEFAULT_SIZE;

      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // gpt-image-1 has no `response_format` param (unlike dall-e-2/3) —
          // it always returns b64_json, and passing the param is a hard 400.
          model,
          prompt: req.prompt,
          size,
          n: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`openai image generation failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { data?: Array<{ b64_json?: string }> };
      const b64 = data.data?.[0]?.b64_json ?? "";

      return {
        imageBase64: b64,
        mimeType: "image/png",
        modelId: model,
      };
    },
  };
}
