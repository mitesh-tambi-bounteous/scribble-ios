/**
 * GET /channels/{id}/members?promptId= — AC4 + AC2 gates (caller identified
 * via x-user-id).
 *
 * This is a membership-roster read that reveals per-member submission status
 * ("has this member drawn today?") — that is peer content just like
 * channel-responses.ts, so it MUST be gated identically:
 *
 * AC4 channel isolation (S-004): before AC2, this handler does a server-side
 * membership check against the membership record (data.getMembership).
 * Non-member -> HTTP 403. Membership is granted by submitting to a channel;
 * this check uses only the server-resolved caller identity, never a
 * client-supplied member/unlocked flag.
 *
 * AC2 submit-to-unlock (ADR 0007): after the membership gate passes, this
 * handler does a server-side EXISTS check against the submission record
 * (data.getSubmission). Missing item -> HTTP 403 (not 200 with empty body,
 * not 404). This is an invariant of the system, never a client-supplied flag.
 *
 * Both gates must pass before any member roster / drawn-today status is
 * returned.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, ChannelMembersResponse } from "@scribl/shared/api";
import { getMembership, getSubmission, listChannelMembers } from "../data";
import { getCallerUserId } from "./identity";
import { maskForeignBackgroundPromptOnMembers } from "./channel-response-privacy";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getCallerUserId(event);
    const channelId = event.pathParameters?.["id"];
    const promptId = event.queryStringParameters?.["promptId"];

    if (!channelId || channelId.length === 0 || !promptId || promptId.length === 0) {
      const error: ApiError = {
        error: "invalid_request",
        message: "channelId (path) and promptId (query) are required",
      };
      return jsonResponse(400, error);
    }

    // AC4 gate: server-side membership authz. Runs before AC2. Uses the
    // server-resolved caller identity only — any client-supplied member/
    // unlocked flag is structurally ignored.
    const isMember = await getMembership(channelId, userId);
    if (!isMember) {
      const error: ApiError = {
        error: "not_a_member",
        message: "join this channel to view its members",
      };
      return jsonResponse(403, error);
    }

    // AC2 gate: server-side EXISTS check against the submission record. Must
    // happen before any peer content (including drawn-today status) is
    // read. Ignores any client-supplied "unlocked" flag entirely.
    const submission = await getSubmission(userId, promptId);
    if (!submission) {
      const error: ApiError = {
        error: "not_submitted",
        message: "submit your response to unlock this channel",
      };
      return jsonResponse(403, error);
    }

    const members = await listChannelMembers(channelId, promptId);

    // backgroundPrompt is creator-private (see domain.ts doc): strip it from
    // every embedded response not authored by the caller before it leaves the API.
    const maskedMembers = maskForeignBackgroundPromptOnMembers(members, userId);
    const response: ChannelMembersResponse = { members: maskedMembers };
    return jsonResponse(200, response);
  } catch (err) {
    const error: ApiError = {
      error: "internal_error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
    return jsonResponse(500, error);
  }
}
