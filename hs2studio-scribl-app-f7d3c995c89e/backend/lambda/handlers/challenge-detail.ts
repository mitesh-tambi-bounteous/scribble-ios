/**
 * GET /challenges/{cid} - the reveal-gated detail read.
 *
 * Blind draw-off invariant, enforced server-side (not UI-only), submit-to-
 * unlock (AC2): reveal is PER-VIEWER (challenge-shared.viewerState) - a
 * caller sees entries/leaderboard iff they have submitted their own entry.
 * Challenges are open-ended (no deadline).
 *
 * Gate order: authenticate -> load challenge (404 not_found) -> membership
 * gate (403 not_a_member, mirrors AC4) -> return blind (state "open") if the
 * caller hasn't submitted, else the full reveal.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, ChallengeDetailResponse } from "@scribl/shared/api";
import type { ChallengeDetail } from "@scribl/shared/domain";
import { countChannelMembers, getChallenge, getMembership, listChallengeEntries } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";
import { buildLeaderboard, viewerState, jsonResponse } from "./challenge-shared";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const callerId = getCallerUserId(event);
    const challengeId = event.pathParameters?.["cid"];

    if (!challengeId || challengeId.length === 0) {
      const error: ApiError = { error: "invalid_request", message: "challengeId (path) is required" };
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
        message: "join this channel to view this challenge",
      };
      return jsonResponse(403, error);
    }

    // Blind while open: count entries without leaking their content.
    const blindEntries = await listChallengeEntries(challengeId);
    const submittedCount = blindEntries.length;
    const participantCount = await countChannelMembers(challenge.channelId);
    const iSubmitted = blindEntries.some((e) => e.userId === callerId);
    const state = viewerState(iSubmitted);

    if (state === "open") {
      const detail: ChallengeDetail = {
        challenge,
        state,
        participantCount,
        submittedCount,
        iSubmitted,
        entries: [],
        leaderboard: [],
      };
      const response: ChallengeDetailResponse = { detail };
      return jsonResponse(200, response);
    }

    const entries = await listChallengeEntries(challengeId, callerId);
    const leaderboard = buildLeaderboard(entries);
    const top = leaderboard[0];
    const winnerEntryId = top && top.ratingCount > 0 ? top.entryId : undefined;

    const detail: ChallengeDetail = {
      challenge,
      state,
      participantCount,
      submittedCount,
      iSubmitted,
      entries: [...entries],
      leaderboard,
      winnerEntryId,
    };
    const response: ChallengeDetailResponse = { detail };
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
