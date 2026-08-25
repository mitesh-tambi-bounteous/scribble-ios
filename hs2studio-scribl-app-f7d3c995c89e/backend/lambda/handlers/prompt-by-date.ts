/**
 * GET /prompt/:date — reads a single day's prompt (YYYY-MM-DD), for the
 * archive/history views that need a prompt other than today's. Mirrors
 * today-prompt.ts's shape but returns only the prompt (no per-user
 * submissionStatus/participants — those are today-prompt.ts's concern).
 *
 * Determinism (AC1): delegates to the same getPromptForDate getter as
 * today-prompt.ts, so the same date always resolves to the same Prompt.id.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, PromptByDateResponse } from "@scribl/shared/api";
import { getPromptForDate } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    getCallerUserId(event); // authed like /prompt/today; identity unused otherwise

    const date = event.pathParameters?.["date"];
    if (!date || !DATE_RE.test(date)) {
      const error: ApiError = {
        error: "invalid_request",
        message: "date (path, YYYY-MM-DD) is required",
      };
      return jsonResponse(400, error);
    }

    let prompt;
    try {
      prompt = await getPromptForDate(date);
    } catch {
      prompt = undefined;
    }

    if (!prompt) {
      const error: ApiError = {
        error: "not_found",
        message: `no prompt found for date ${date}`,
      };
      return jsonResponse(404, error);
    }

    const response: PromptByDateResponse = { prompt };
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
