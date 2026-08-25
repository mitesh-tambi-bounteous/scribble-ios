/**
 * GET /channels/{id}/challenges - lists challenge summaries for a channel.
 *
 * Membership gate: only a member of the channel may list its challenges
 * (server-side getMembership, mirroring AC4 on channel-responses.ts). No
 * entry images are included here; that's the challenge-detail handler's
 * job.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, ListChallengesResponse } from "@scribl/shared/api";
import type { ChallengeSummary } from "@scribl/shared/domain";
import {
  countChannelMembers,
  getChallengeEntryForUser,
  getMembership,
  listChallengeEntries,
  listChallengesForChannel,
} from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";
import { buildLeaderboard, viewerState, jsonResponse } from "./challenge-shared";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const callerId = getCallerUserId(event);
    const channelId = event.pathParameters?.["id"];

    if (!channelId || channelId.length === 0) {
      const error: ApiError = { error: "invalid_request", message: "channelId (path) is required" };
      return jsonResponse(400, error);
    }

    const isMember = await getMembership(channelId, callerId);
    if (!isMember) {
      const error: ApiError = {
        error: "not_a_member",
        message: "join this channel to view its challenges",
      };
      return jsonResponse(403, error);
    }

    const challenges = await listChallengesForChannel(channelId);

    const summaries: ChallengeSummary[] = [];
    for (const challenge of challenges) {
      const entries = await listChallengeEntries(challenge.id);
      const submittedCount = entries.length;
      const participantCount = await countChannelMembers(channelId);
      const myEntry = await getChallengeEntryForUser(challenge.id, callerId);
      const iSubmitted = !!myEntry;
      const state = viewerState(iSubmitted);

      let winnerEntryId: string | undefined;
      if (state === "revealed") {
        const top = buildLeaderboard(entries)[0];
        if (top && top.ratingCount > 0) {
          winnerEntryId = top.entryId;
        }
      }

      summaries.push({
        challenge,
        state,
        participantCount,
        submittedCount,
        iSubmitted,
        winnerEntryId,
      });
    }

    const response: ListChallengesResponse = { challenges: summaries };
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
