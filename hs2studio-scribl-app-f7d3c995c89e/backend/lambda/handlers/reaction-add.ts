/**
 * POST /channels/{id}/responses/{responseId}/reactions?promptId= - AC2 + AC4
 * gates on a write path.
 *
 * Adding a reaction to a peer's response reveals (via 403 vs 200) whether the
 * caller is a member of the channel and has submitted for the prompt, so
 * this write must be gated identically to the channel-responses.ts read:
 *
 * AC4 channel isolation (S-004): server-side membership check
 * (data.getMembership) against the caller's server-resolved identity.
 * Non-member -> HTTP 403. Runs before AC2.
 *
 * AC2 submit-to-unlock (ADR 0007): server-side EXISTS check against the
 * submission record (data.getSubmission) for the caller + promptId. Missing
 * -> HTTP 403. Only after both gates pass is the reaction written.
 *
 * promptId is required as a query param (mirrors channel-responses.ts) so
 * gating never depends on a client-supplied claim about the response's
 * prompt/channel - the target response must actually be found in that
 * channel+prompt's server-side response list before the write proceeds.
 *
 * Self-reaction guard (spec 4.4 / Bug #3, by design): a user may react to
 * OTHERS' responses but not their own. Enforced here against the loaded
 * response's authorId (never a client-supplied claim) -> HTTP 403
 * cannot_react_own. Runs after AC4/AC2 so it never leaks membership or
 * submission state ahead of those checks.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { AddReactionRequest, AddReactionResponse, ApiError } from "@scribl/shared/api";
import { getMembership, getSubmission, listChannelResponses, putReaction } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isValidRequest(parsed: AddReactionRequest | undefined): parsed is AddReactionRequest {
  if (!parsed) {
    return false;
  }
  return typeof parsed.emoji === "string" && parsed.emoji.trim().length > 0;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getCallerUserId(event);
    const channelId = event.pathParameters?.["id"];
    const responseId = event.pathParameters?.["responseId"];
    const promptId = event.queryStringParameters?.["promptId"];

    let parsed: AddReactionRequest | undefined;
    try {
      parsed = event.body ? (JSON.parse(event.body) as AddReactionRequest) : undefined;
    } catch {
      parsed = undefined;
    }

    if (
      !channelId ||
      channelId.length === 0 ||
      !responseId ||
      responseId.length === 0 ||
      !promptId ||
      promptId.length === 0 ||
      !isValidRequest(parsed)
    ) {
      const error: ApiError = {
        error: "invalid_request",
        message:
          "channelId + responseId (path), promptId (query), and emoji (non-empty string body) are required",
      };
      return jsonResponse(400, error);
    }

    // AC4 gate: server-side membership authz, before AC2. Ignores any
    // client-supplied member/unlocked claim entirely.
    const isMember = await getMembership(channelId, userId);
    if (!isMember) {
      const error: ApiError = {
        error: "not_a_member",
        message: "join this channel to react to its responses",
      };
      return jsonResponse(403, error);
    }

    // AC2 gate: server-side EXISTS check against the submission record.
    const submission = await getSubmission(userId, promptId);
    if (!submission) {
      const error: ApiError = {
        error: "not_submitted",
        message: "submit your response to unlock this channel",
      };
      return jsonResponse(403, error);
    }

    const responses = await listChannelResponses(channelId, promptId);
    const target = responses.find((r) => r.id === responseId);
    if (!target) {
      const error: ApiError = {
        error: "not_found",
        message: "no such response in this channel for this prompt",
      };
      return jsonResponse(404, error);
    }

    // Product rule (spec 4.4 / Bug #3, by design): a user can react to
    // others' responses but not to their own. Enforced server-side against
    // the already-loaded response's authorId, never a client claim.
    if (target.authorId === userId) {
      const error: ApiError = {
        error: "cannot_react_own",
        message: "You cannot react to your own response.",
      };
      return jsonResponse(403, error);
    }

    await putReaction(responseId, userId, parsed.emoji);

    const updatedResponses = await listChannelResponses(channelId, promptId);
    const updated = updatedResponses.find((r) => r.id === responseId) ?? {
      ...target,
      reactions: [...target.reactions, { emoji: parsed.emoji, userId }],
    };

    const response: AddReactionResponse = { response: updated };
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
