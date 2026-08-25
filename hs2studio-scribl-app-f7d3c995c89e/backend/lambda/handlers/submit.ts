/**
 * POST /submit — implemented by S-003 (submit-to-unlock, AC2).
 *
 * Writes the submission item keyed by (userId, promptId). This is the ONLY
 * write path that creates the item the AC2 EXISTS check in
 * channel-responses.ts depends on. No authorization beyond caller identity
 * is required to submit — the gate is on the read path, not here.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, SubmitRequest, SubmitResponse } from "@scribl/shared/api";
import type { Submission } from "@scribl/shared/domain";
import { putSubmission } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";
import { triggerEnhancement } from "../enhance/trigger";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isValidRequest(parsed: SubmitRequest | undefined): parsed is SubmitRequest {
  if (!parsed) {
    return false;
  }
  if (typeof parsed.promptId !== "string" || parsed.promptId.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(parsed.channelIds) || parsed.channelIds.length === 0) {
    return false;
  }
  return true;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getCallerUserId(event);

    let parsed: SubmitRequest | undefined;
    try {
      parsed = event.body ? (JSON.parse(event.body) as SubmitRequest) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!isValidRequest(parsed)) {
      const error: ApiError = {
        error: "invalid_request",
        message: "promptId (non-empty string) and channelIds (non-empty array) are required",
      };
      return jsonResponse(400, error);
    }

    const { promptId, channelIds, text, imageRef } = parsed;

    const submission: Submission & { text?: string; imageRef?: string } = {
      id: `submission-${userId}-${promptId}`,
      userId,
      promptId,
      channelIds,
      createdAt: new Date().toISOString(),
      text,
      imageRef,
    };

    const responseIds = await putSubmission(submission);

    // Fire-and-forget (T4): never awaited, never changes this response body
    // or latency. No-ops unless ENHANCE_ENABLED and an image was submitted.
    // promptId is passed through (not resolved to text here) so the
    // best-effort prompt-text lookup happens inside the async trigger body,
    // never on this synchronous submit path.
    for (const responseId of responseIds) {
      triggerEnhancement({ responseId, imageDataUri: imageRef, promptId });
    }

    const response: SubmitResponse = { submission };
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
