/**
 * Scribl POC — Claude provider-abstraction types.
 *
 * One seam, three operations: generate / describeImage / moderate.
 * ADR 0009: adapters (stub, direct, bedrock, platform) sit behind this
 * interface and are selected by config — never by call-site code (AC8).
 * "claude" is a documented alias of "direct" (same adapter, same behavior).
 */

/** Supported adapter hosts. "stub" is the POC default. "claude" aliases "direct". */
export type ProviderKind = "stub" | "direct" | "claude" | "bedrock" | "platform";

/** The three product-side Claude touchpoints (ADR 0011 tiers them). */
export type ClaudeOperation = "generate" | "describeImage" | "moderate";

/** Per-call token accounting, logged by every adapter (ADR 0009). */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** A single log record emitted after every adapter call. */
export interface TokenLogEntry {
  operation: ClaudeOperation;
  modelId: string;
  provider: ProviderKind;
  usage: TokenUsage;
  timestamp: string;
}

/** generate — text generation (e.g. the daily prompt). Opus tier. */
export interface GenerateRequest {
  /** System/instruction prompt. */
  prompt: string;
  maxOutputTokens?: number;
}

export interface GenerateResponse {
  text: string;
  modelId: string;
  usage: TokenUsage;
}

/** describeImage — vision caption of a drawing. Sonnet-vision tier. */
export interface DescribeImageRequest {
  /** Base64-encoded image bytes. No audio ever flows through this seam. */
  imageBase64: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  /** Optional context, e.g. the prompt the drawing responds to. */
  context?: string;
}

export interface DescribeImageResponse {
  caption: string;
  modelId: string;
  usage: TokenUsage;
}

/** moderate — content moderation classification. Haiku tier. */
export interface ModerateRequest {
  /** Text only. If voice is ever wired, only the transcript lands here. */
  text: string;
}

export type ModerationVerdict = "allow" | "flag" | "block";

export interface ModerateResponse {
  verdict: ModerationVerdict;
  reason?: string;
  modelId: string;
  usage: TokenUsage;
}

/**
 * The provider-abstraction seam. Feature code depends only on this
 * interface, never on a concrete adapter or the Anthropic SDK directly.
 */
export interface ProviderAdapter {
  readonly provider: ProviderKind;
  generate(req: GenerateRequest): Promise<GenerateResponse>;
  describeImage(req: DescribeImageRequest): Promise<DescribeImageResponse>;
  moderate(req: ModerateRequest): Promise<ModerateResponse>;
}

/** Config that selects and constructs an adapter. */
export interface ProviderConfig {
  provider: ProviderKind;
  apiKey?: string;
  /** AWS region for the Bedrock adapter (falls back to AWS_REGION env). */
  region?: string;
}

/** No-op-friendly logger seam; the POC default just records, never throws. */
export type TokenLogger = (entry: TokenLogEntry) => void;
