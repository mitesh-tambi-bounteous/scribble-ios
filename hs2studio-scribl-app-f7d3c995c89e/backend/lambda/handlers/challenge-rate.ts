/**
 * POST /challenges/{cid}/entries/{eid}/ratings - post-reveal star rating.
 *
 * Reveal is PER-VIEWER (challenge-shared.viewerState, submit-to-unlock/AC2):
 * a caller may only rate once they themselves have submitted an entry.
 * Challenges are open-ended (no deadline).
 *
 * Gate order: authenticate -> path params required (400 invalid_request) ->
 * load challenge (404 not_found) -> membership gate (403 not_a_member,
 * mirrors AC4) -> caller must have submitted (403 not_submitted) -> body
 * {stars} must be an integer 1..5 (400 invalid_request) -> target entry must
 * exist in this challenge (404 not_found) -> cannot rate own entry (403
 * cannot_rate_own) -> write the rating and return the re-read entry so
 * averageStars/ratingCount/myStars reflect the write. All gates are
 * server-side against data-layer records, never a client-supplied flag.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, RateEntryRequest, RateEntryResponse } from "@scribl/shared/api";
import {
  getChallenge,
  getMembership,
  listChallengeEntries,
  putRating,
} from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";
import { viewerState, jsonResponse } from "./challenge-shared";

function parseStars(body: string | undefined): number | undefined {
  if (!body) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(body) as RateEntryRequest;
    return parsed.stars;
  } catch {
    return undefined;
  }
}

function isValidStars(stars: unknown): stars is number {
  return typeof stars === "number" && Number.isInteger(stars) && stars >= 1 && stars <= 5;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const callerId = getCallerUserId(event);
    const challengeId = event.pathParameters?.["cid"];
    const entryId = event.pathParameters?.["eid"];

    if (!challengeId || challengeId.length === 0 || !entryId || entryId.length === 0) {
      const error: ApiError = {
        error: "invalid_request",
        message: "challengeId and entryId (path) are required",
      };
      return jsonResponse(400, error);
    }

    const challenge = await getChallenge(challengeId);
    if (!challenge) {
      const error: ApiError = { error: "not_found", message: "challenge not found" };
      return jsonResponse(404, error);
    }

    const isMember = await getMembership(challenge.channelId, callerId);
    if (!isMember) {
      const error: ApiError = {
        error: "not_a_member",
        message: "join this channel to rate entries",
      };
      return jsonResponse(403, error);
    }

    const entries = await listChallengeEntries(challengeId, callerId);
    const iSubmitted = entries.some((e) => e.userId === callerId);
    const state = viewerState(iSubmitted);

    if (state !== "revealed") {
      const error: ApiError = {
        error: "not_submitted",
        message: "submit an entry before rating others",
      };
      return jsonResponse(403, error);
    }

    const stars = parseStars(event.body);
    if (!isValidStars(stars)) {
      const error: ApiError = {
        error: "invalid_request",
        message: "stars must be an integer from 1 to 5",
      };
      return jsonResponse(400, error);
    }

    const targetEntry = entries.find((e) => e.id === entryId);
    if (!targetEntry) {
      const error: ApiError = { error: "not_found", message: "entry not found" };
      return jsonResponse(404, error);
    }

    if (targetEntry.userId === callerId) {
      const error: ApiError = { error: "cannot_rate_own", message: "you cannot rate your own entry" };
      return jsonResponse(403, error);
    }

    await putRating({ challengeId, entryId, raterId: callerId, stars });

    const updatedEntries = await listChallengeEntries(challengeId, callerId);
    const updatedEntry = updatedEntries.find((e) => e.id === entryId);
    if (!updatedEntry) {
      const error: ApiError = { error: "internal_error", message: "rating write did not persist" };
      return jsonResponse(500, error);
    }

    const response: RateEntryResponse = { entry: updatedEntry };
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
