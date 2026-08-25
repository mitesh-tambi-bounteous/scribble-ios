/**
 * GET /channels/{id}/responses?promptId= — AC2 + AC4 gates.
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
 * Both gates must pass before any peer content is returned.
 *
 * EXCEPTION — Personal Archive (task #6): channels whose id ends in
 * `-archive` are a single owner's own private drawing history. There is no
 * cross-user isolation concern for them (the AC4 membership gate above still
 * runs and still denies non-owners), and requiring a submission to *today's*
 * prompt before the owner can see their OWN past art would be a nonsensical
 * gate — the archive isn't prompt-of-the-day scoped. So archive channels are
 * exempt from the AC2 EXISTS check ONLY; every non-archive (group) channel
 * keeps the gate exactly as-is.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, ChannelResponsesResponse } from "@scribl/shared/api";
import { getMembership, getSubmission, listChannelResponses } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";
import { maskForeignBackgroundPrompt } from "./channel-response-privacy";

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
    // server-resolved caller identity only — any client-supplied member/unlocked
    // flag is structurally ignored.
    const isMember = await getMembership(channelId, userId);
    if (!isMember) {
      const error: ApiError = {
        error: "not_a_member",
        message: "join this channel to view its responses",
      };
      return jsonResponse(403, error);
    }

    // AC2 gate: server-side EXISTS check against the submission record. Must
    // happen before any peer content is read. Ignores any client-supplied
    // "unlocked" flag entirely. EXEMPT for the caller's own Personal Archive
    // (see the file-level comment above) — the AC4 membership check just
    // above still requires the caller to actually be a member, i.e. the
    // channel's own owner, before reaching here.
    const isArchiveChannel = channelId.endsWith("-archive");
    if (!isArchiveChannel) {
      const submission = await getSubmission(userId, promptId);
      if (!submission) {
        const error: ApiError = {
          error: "not_submitted",
          message: "submit your response to unlock this channel",
        };
        return jsonResponse(403, error);
      }
    }

    const responses = await listChannelResponses(channelId, promptId);

    // backgroundPrompt is creator-private (see domain.ts doc): strip it from
    // every response not authored by the caller before it leaves the API.
    const maskedResponses = maskForeignBackgroundPrompt(responses, userId);

    const response: ChannelResponsesResponse = {
      channelId,
      promptId,
      responses: maskedResponses,
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
