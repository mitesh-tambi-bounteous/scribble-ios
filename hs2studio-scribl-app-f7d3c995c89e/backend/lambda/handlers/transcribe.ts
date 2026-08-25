/**
 * POST /transcribe — voice-to-text behind the transcription seam.
 *
 * Identity-gated. Default (no STT_API_KEY) is the deterministic stub
 * adapter, so e2e/CI stay green with no cloud key. Only the resulting
 * transcript ever flows further (e.g. to moderation) — never raw audio.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, TranscribeRequest, TranscribeResponse } from "@scribl/shared/api";
import { getCallerUserId, UnauthenticatedError } from "./identity";
import { createTranscriptionProvider, transcriptionConfigFromEnv } from "../transcription";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isValidRequest(parsed: TranscribeRequest | undefined): parsed is TranscribeRequest {
  if (!parsed) {
    return false;
  }
  if (typeof parsed.audioBase64 !== "string" || parsed.audioBase64.trim().length === 0) {
    return false;
  }
  if (typeof parsed.mimeType !== "string" || parsed.mimeType.trim().length === 0) {
    return false;
  }
  return true;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    getCallerUserId(event);

    let parsed: TranscribeRequest | undefined;
    try {
      parsed = event.body ? (JSON.parse(event.body) as TranscribeRequest) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!isValidRequest(parsed)) {
      const error: ApiError = {
        error: "invalid_request",
        message: "audioBase64 and mimeType (non-empty strings) are required",
      };
      return jsonResponse(400, error);
    }

    const provider = createTranscriptionProvider(transcriptionConfigFromEnv());
    const { transcript } = await provider.transcribe({
      audioBase64: parsed.audioBase64,
      mimeType: parsed.mimeType,
    });

    const response: TranscribeResponse = { transcript };
    return jsonResponse(200, response);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      const error: ApiError = { error: "unauthenticated", message: err.message };
      return jsonResponse(401, error);
    }
    const error: ApiError = {
      error: "internal_error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
    return jsonResponse(500, error);
  }
}
