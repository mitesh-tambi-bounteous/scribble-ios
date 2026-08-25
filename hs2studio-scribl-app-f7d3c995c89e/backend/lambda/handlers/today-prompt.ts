/**
 * GET /prompt/today — LIVE endpoint (the one foundation slice that actually
 * works end to end). Returns today's seeded prompt plus the caller's
 * submission status for it.
 *
 * Determinism (AC1): the prompt id is derived from the calendar date, so any
 * two callers hitting this endpoint on the same day resolve to the same
 * Prompt.id, regardless of caller identity.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, TodayPromptResponse } from "@scribl/shared/api";
import { getPromptForDate, getPromptParticipants, getSubmission } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function todayIsoDate(): string {
  const iso = new Date().toISOString();
  const datePart = iso.slice(0, 10);
  return datePart;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getCallerUserId(event);
    const date = todayIsoDate();

    const prompt = await getPromptForDate(date);
    const [submission, promptParticipants] = await Promise.all([
      getSubmission(userId, prompt.id),
      getPromptParticipants(prompt.id),
    ]);

    const response: TodayPromptResponse = {
      prompt,
      submissionStatus: {
        submitted: submission !== undefined,
        submittedAt: submission?.createdAt,
      },
      participantCount: promptParticipants.count,
      participants: promptParticipants.participants,
    };

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
