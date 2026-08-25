/**
 * GET /channels/{id}/roster — AC4 gate ONLY (caller identified via
 * x-user-id).
 *
 * Why there is NO AC2 submit-to-unlock gate here: this endpoint returns only
 * membership identity (userId/displayName/email/avatarColor) plus the
 * channel's creator — never peer art, never drawn-today status, never a
 * response. AC2 (ADR 0007) exists specifically to gate PEER CONTENT (a
 * response revealing what someone else drew/wrote) behind having submitted
 * yourself. A bare membership + creator listing is not peer content, so AC2
 * does not apply. This is the same reasoning that separates this handler
 * from channel-members.ts, which DOES include per-member hasDrawnToday /
 * response and therefore DOES require the AC2 gate.
 *
 * AC4 channel isolation (S-004) still fully applies: before returning
 * anything, this handler does a server-side membership check against the
 * membership record (data.getMembership), using only the server-resolved
 * caller identity — never a client-supplied member/unlocked flag. Non-member
 * -> HTTP 403.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, ChannelRosterResponse } from "@scribl/shared/api";
import { getChannelCreator, getMembership, listChannelRoster } from "../data";
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
    const userId = getCallerUserId(event);
    const channelId = event.pathParameters?.["id"];

    if (!channelId || channelId.length === 0) {
      const error: ApiError = {
        error: "invalid_request",
        message: "channelId (path) is required",
      };
      return jsonResponse(400, error);
    }

    // AC4 gate: server-side membership authz. Uses the server-resolved
    // caller identity only — any client-supplied member/unlocked flag is
    // structurally ignored.
    const isMember = await getMembership(channelId, userId);
    if (!isMember) {
      const error: ApiError = {
        error: "not_a_member",
        message: "join this channel to view its members",
      };
      return jsonResponse(403, error);
    }

    const response: ChannelRosterResponse = {
      createdBy: (await getChannelCreator(channelId)) ?? "",
      members: [...(await listChannelRoster(channelId))],
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
