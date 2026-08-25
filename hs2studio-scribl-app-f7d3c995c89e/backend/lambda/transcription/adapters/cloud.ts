/**
 * Scribl POC — cloud transcription adapter (Whisper-style HTTP STT).
 *
 * Minimal POC seam: decodes the base64 audio and posts it as multipart form
 * data to a Whisper-compatible transcription endpoint. Only constructed by
 * the factory when a real API key is present (factory falls back to stub
 * otherwise). No secrets are hardcoded here.
 */
import type { TranscribeInput, TranscribeOutput, TranscriptionConfig, TranscriptionProvider } from "../types";

const DEFAULT_MODEL = "whisper-1";
const DEFAULT_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

export function createCloudTranscriptionAdapter(config: TranscriptionConfig): TranscriptionProvider {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error("createCloudTranscriptionAdapter requires an apiKey (guard in factory)");
  }
  const model = config.model ?? DEFAULT_MODEL;

  return {
    provider: "cloud",

    async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
      const audioBytes = Buffer.from(input.audioBase64, "base64");
      const extension = input.mimeType.includes("wav") ? "wav" : "webm";

      const form = new FormData();
      form.append("model", model);
      form.append(
        "file",
        new Blob([audioBytes], { type: input.mimeType }),
        `audio.${extension}`,
      );

      const response = await fetch(DEFAULT_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!response.ok) {
        throw new Error(`cloud transcription failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { text?: string };
      return { transcript: data.text ?? "" };
    },
  };
}
