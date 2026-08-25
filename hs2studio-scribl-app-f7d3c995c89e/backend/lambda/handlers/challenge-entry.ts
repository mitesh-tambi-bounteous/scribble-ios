/**
 * POST /challenges/{cid}/entries - submit a blind draw-off entry.
 *
 * Challenges are open-ended (no deadline/expiry) - there is no closed gate.
 *
 * Gate order: authenticate -> load challenge (404 not_found) -> membership
 * gate (403 not_a_member, mirrors AC4) -> duplicate-submission gate (409
 * already_submitted). All gates are server-side against data-layer records,
 * never a client-supplied flag.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, SubmitChallengeEntryRequest, SubmitChallengeEntryResponse } from "@scribl/shared/api";
import {
  getChallenge,
  getChallengeEntryForUser,
  getMembership,
  putChallengeEntry,
} from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";
import { jsonResponse } from "./challenge-shared";

function parseBody(body: string | undefined): SubmitChallengeEntryRequest | undefined {
  if (!body) {
    return {};
  }
  try {
    return JSON.parse(body) as SubmitChallengeEntryRequest;
  } catch {
    return undefined;
  }
}

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
        message: "join this channel to submit an entry",
      };
      return jsonResponse(403, error);
    }

    const existing = await getChallengeEntryForUser(challengeId, callerId);
    if (existing) {
      const error: ApiError = { error: "already_submitted", message: "you already submitted an entry" };
      return jsonResponse(409, error);
    }

    const parsed = parseBody(event.body);
    if (!parsed) {
      const error: ApiError = { error: "invalid_request", message: "malformed request body" };
      return jsonResponse(400, error);
    }

    await putChallengeEntry({
      id: `entry-${challengeId}-${callerId}`,
      challengeId,
      userId: callerId,
      imageRef: parsed.imageRef,
    });

    const entry = await getChallengeEntryForUser(challengeId, callerId);
    if (!entry) {
      const error: ApiError = { error: "internal_error", message: "entry write did not persist" };
      return jsonResponse(500, error);
    }

    const response: SubmitChallengeEntryResponse = { entry };
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
