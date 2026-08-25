/**
 * Scribl POC — stub transcription adapter (DEFAULT for POC/dev/CI).
 *
 * Deterministic transcript, no network calls. Keeps e2e/CI green with no
 * API key configured.
 */
import type { TranscribeInput, TranscribeOutput, TranscriptionProvider } from "../types";

/** Fixed, believable transcript asserted on by e2e/CI. */
export const STUB_TRANSCRIPT = "A quick doodle of my morning coffee and the sunrise.";

export function createStubTranscriptionAdapter(): TranscriptionProvider {
  return {
    provider: "stub",
    async transcribe(_input: TranscribeInput): Promise<TranscribeOutput> {
      return { transcript: STUB_TRANSCRIPT };
    },
  };
}
