/**
 * GET /channels/{id}/days — AC4-gated (membership) but NOT AC2-gated.
 *
 * Returns only date metadata + response counts (never art/response content),
 * so submit-to-unlock does not apply here — mirrors channel-roster.ts's
 * rationale. Newest day first.
 *
 * AC4 channel isolation (S-004): server-side membership check against the
 * membership record (data.getMembership). Non-member -> HTTP 403. Uses only
 * the server-resolved caller identity, never a client-supplied flag.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, ChannelDaysResponse } from "@scribl/shared/api";
import { getMembership, listChannelDays } from "../data";
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
        message: "join this channel to view its days",
      };
      return jsonResponse(403, error);
    }

    const days = await listChannelDays(channelId);
    const response: ChannelDaysResponse = { days: [...days] };
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
