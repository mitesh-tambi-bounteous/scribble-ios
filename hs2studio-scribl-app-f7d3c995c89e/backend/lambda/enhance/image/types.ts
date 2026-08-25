/**
 * Scribl POC — image-generation seam types.
 *
 * A SEPARATE seam from the Claude provider-adapter (packages/claude-provider-adapter)
 * AND from the transcription seam (backend/lambda/transcription). This seam only ever
 * generates a background image from TEXT. It is a data boundary / North Star rule:
 * no user drawing/image ever enters GenerateBackgroundRequest — text prompt in,
 * image out, never the reverse.
 */

/** Supported image-generation hosts. "stub" is the POC/CI default (no key needed). */
export type ImageProviderKind = "stub" | "openai";

export interface GenerateBackgroundRequest {
  /** Text prompt only. NO user image/drawing ever enters this request. */
  prompt: string;
  size?: string;
}

export interface GenerateBackgroundResult {
  imageBase64: string;
  mimeType: "image/png";
  modelId: string;
}

/** The image-generation seam. Feature code depends only on this interface. */
export interface ImageProvider {
  readonly provider: ImageProviderKind;
  generateBackground(req: GenerateBackgroundRequest): Promise<GenerateBackgroundResult>;
}

/** Config that selects and constructs an image provider. */
export interface ImageConfig {
  provider: ImageProviderKind;
  apiKey?: string;
  model?: string;
}
