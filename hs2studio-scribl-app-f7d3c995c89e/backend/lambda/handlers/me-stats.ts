/**
 * GET /me/stats - identity-gated real aggregates for the caller (WS4a).
 *
 * Identity-gated only (no channel/membership authz here): the caller can only
 * ever see their own submission history, resolved from the x-user-id header
 * the same way submit.ts / walls-create.ts do. Missing header -> 401.
 *
 * Streak / weekly-completion math is delegated to the pure, unit-tested
 * helpers in backend/lambda/data/stats.ts so this handler stays thin:
 * fetch the caller's distinct submission dates + total count, then derive.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, MeStatsResponse } from "@scribl/shared/api";
import { countUserSubmissions, getUserSubmissionDates } from "../data";
import { computeBadges, computeStreaks, computeWeeklyCompletion } from "../data/stats";
import { getCallerUserId, UnauthenticatedError } from "./identity";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getCallerUserId(event);
    const today = todayIsoDate();

    const [drawingsCount, submissionDates] = await Promise.all([
      countUserSubmissions(userId),
      getUserSubmissionDates(userId),
    ]);

    const weeklyCompletion = computeWeeklyCompletion(submissionDates, today);
    const { currentStreak, bestStreak } = computeStreaks(submissionDates, today);
    const badges = computeBadges(bestStreak);

    const response: MeStatsResponse = {
      drawingsCount,
      weeklyCompletion,
      currentStreak,
      bestStreak,
      badges,
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
