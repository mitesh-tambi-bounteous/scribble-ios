/**
 * Scribl POC — transcription seam types.
 *
 * A SEPARATE seam from the Claude provider-adapter (packages/claude-provider-adapter).
 * That seam's types.ts explicitly excludes audio; this seam is voice-in only and
 * never forwards audio anywhere else — only the resulting transcript may flow on
 * to moderation.
 */

/** Supported transcription hosts. "stub" is the POC/CI default (no key needed). */
export type TranscriptionProviderKind = "stub" | "cloud";

export interface TranscribeInput {
  /** Base64-encoded audio bytes. */
  audioBase64: string;
  mimeType: string;
}

export interface TranscribeOutput {
  transcript: string;
}

/** The transcription seam. Feature code depends only on this interface. */
export interface TranscriptionProvider {
  readonly provider: TranscriptionProviderKind;
  transcribe(input: TranscribeInput): Promise<TranscribeOutput>;
}

/** Config that selects and constructs a transcription provider. */
export interface TranscriptionConfig {
  provider: TranscriptionProviderKind;
  apiKey?: string;
  model?: string;
}
