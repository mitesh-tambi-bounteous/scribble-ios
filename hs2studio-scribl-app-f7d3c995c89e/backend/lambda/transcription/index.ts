/**
 * Scribl POC — transcription seam public surface.
 *
 * Feature code (handlers) imports only from here, never from an adapter
 * file directly.
 */
export type {
  TranscribeInput,
  TranscribeOutput,
  TranscriptionConfig,
  TranscriptionProvider,
  TranscriptionProviderKind,
} from "./types";

export {
  createTranscriptionProvider,
  transcriptionConfigFromEnv,
  DEFAULT_TRANSCRIPTION_CONFIG,
} from "./factory";

export { STUB_TRANSCRIPT } from "./adapters/stub";
