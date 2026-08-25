/**
 * DELETE /channels/{id}/members - self-leave OR creator-initiated removal.
 * Contract (BF-15, extended for creator removal):
 *   - Caller identified the same way member-add.ts does (getCallerUserId).
 *   - `?userId=` (query) is the target to remove; defaults to the caller
 *     (self-leave) when absent.
 *   - Self-leave (target === caller): allowed by identity alone, EXCEPT the
 *     sole remaining member who is also the creator — that leave is blocked
 *     (409 sole_owner) to avoid orphaning the channel.
 *   - Removing someone else (target !== caller): only the channel creator
 *     (data.getChannelCreator) may do this. Non-creator callers get 403
 *     not_creator. INVARIANT: since only the creator can ever target a
 *     userId other than themselves, the creator can never be removed by
 *     anyone else — the only way the creator loses membership is by
 *     self-leaving.
 *   - Returns 200 with { ok: true } on success.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError } from "@scribl/shared/api";
import { countChannelMembers, deleteMembership, getChannelCreator } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";

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
    const callerId = getCallerUserId(event);
    const channelId = event.pathParameters?.["id"];

    if (!channelId || channelId.length === 0) {
      const error: ApiError = {
        error: "invalid_request",
        message: "channelId (path) is required",
      };
      return jsonResponse(400, error);
    }

    const target = event.queryStringParameters?.["userId"] ?? callerId;

    if (target === callerId) {
      // Self-leave: no further authz needed beyond identity, but the sole
      // creator may not leave (would orphan the channel with no member left
      // to manage it).
      const creator = await getChannelCreator(channelId);
      if (creator === callerId) {
        const memberCount = await countChannelMembers(channelId);
        if (memberCount <= 1) {
          const error: ApiError = {
            error: "sole_owner",
            message: "the sole owner cannot leave this wall",
          };
          return jsonResponse(409, error);
        }
      }
      await deleteMembership(channelId, callerId);
      return jsonResponse(200, { ok: true });
    }

    // Removing someone else: only the channel creator may do this. A
    // non-creator can only ever target themselves (handled above), so the
    // creator can never be removed by others.
    const creator = await getChannelCreator(channelId);
    if (creator !== callerId) {
      const error: ApiError = {
        error: "not_creator",
        message: "only the wall creator can remove other members",
      };
      return jsonResponse(403, error);
    }

    await deleteMembership(channelId, target);

    return jsonResponse(200, { ok: true });
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
