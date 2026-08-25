import type { TranscribeRequest, TranscribeResponse } from "@scribl/shared/index";

import { getActiveUserId } from "@/src/data/active-user";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const API_MODE = process.env.EXPO_PUBLIC_API_MODE ?? "mock";

/** Thrown when transcription cannot be attempted or fails server-side. */
export class TranscriptionError extends Error {
  constructor(message = "Could not transcribe your voice note.") {
    super(message);
    this.name = "TranscriptionError";
  }
}

/** Reads a Blob into a base64 string (without the data: URI prefix). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new TranscriptionError());
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new TranscriptionError());
        return;
      }
      // strips "data:<mime>;base64," prefix
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Transcribes a recorded voice note (given as a playable uri, e.g. a
 * blob:/object URL from src/services/audioRecorder) via the backend
 * /transcribe endpoint (mirrors src/data/http.ts's request shape).
 *
 * Throws TranscriptionError when the http data client is not configured
 * (mock mode has no real speech backend) or the request itself fails; the
 * caller (app/write.tsx) treats this as non-blocking.
 */
export async function transcribe(audioUri: string): Promise<TranscribeResponse> {
  if (API_MODE !== "http" || !API_BASE_URL) {
    throw new TranscriptionError("Voice transcription is unavailable in mock mode.");
  }

  let blob: Blob;
  try {
    const fetched = await fetch(audioUri);
    blob = await fetched.blob();
  } catch (caught) {
    throw new TranscriptionError(
      caught instanceof Error ? caught.message : "Could not read the recorded audio.",
    );
  }

  const audioBase64 = await blobToBase64(blob);
  const mimeType = blob.type || "audio/webm";
  const body: TranscribeRequest = { audioBase64, mimeType };

  const headers: Record<string, string> = { "content-type": "application/json" };
  const userId = getActiveUserId();
  if (userId) headers["x-user-id"] = userId;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (caught) {
    throw new TranscriptionError(
      caught instanceof Error ? caught.message : "Can't reach the server to transcribe audio.",
    );
  }

  if (!response.ok) {
    throw new TranscriptionError(`Transcription failed with status ${response.status}`);
  }

  return (await response.json()) as TranscribeResponse;
}
