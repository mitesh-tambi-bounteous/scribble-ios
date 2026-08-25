/**
 * POST /channels/{id}/members - invite a user (by email) into a channel.
 *
 * The caller must be the channel's creator/owner (server-derived via
 * data.getChannelCreator against the caller's server-resolved identity,
 * never a client-supplied claim) — only the owner may add members. Once
 * authorized, the invitee is resolved-or-created by email (idempotent) and
 * granted membership, so they can subsequently pass the AC4 gate on
 * channel-responses.ts / channel-members.ts reads.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, InviteMemberRequest, InviteMemberResponse } from "@scribl/shared/api";
import { isValidEmail } from "@scribl/shared/email";
import { createUser, getChannelCreator, putMembership } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Defense-in-depth: rejects any malformed or multi-email string before it
 * ever reaches createUser. Does NOT mutate parsed.email (no trimming here) —
 * a raw "a@x.com,b@x.com" or whitespace-containing string must fail this
 * check and hit the 400 invalid_request path, never be silently cleaned up.
 */
function isValidRequest(parsed: InviteMemberRequest | undefined): parsed is InviteMemberRequest {
  if (!parsed) {
    return false;
  }
  const { email } = parsed;
  if (typeof email !== "string" || email.length === 0) {
    return false;
  }
  if (email.includes(",") || /\s/.test(email)) {
    return false;
  }
  return isValidEmail(email);
}

function displayNameFromEmail(email: string): string {
  return email.split("@")[0] ?? email;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const callerId = getCallerUserId(event);
    const channelId = event.pathParameters?.["id"];

    let parsed: InviteMemberRequest | undefined;
    try {
      parsed = event.body ? (JSON.parse(event.body) as InviteMemberRequest) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!channelId || channelId.length === 0 || !isValidRequest(parsed)) {
      const error: ApiError = {
        error: "invalid_request",
        message: "channelId (path) and email (non-empty string body) are required",
      };
      return jsonResponse(400, error);
    }

    // Authz gate: only the channel's creator/owner (server-derived via
    // data.getChannelCreator, never a client-supplied claim) may invite
    // others into it.
    const creator = await getChannelCreator(channelId);
    if (!creator || creator !== callerId) {
      const error: ApiError = {
        error: "not_creator",
        message: "only the wall owner can add members",
      };
      return jsonResponse(403, error);
    }

    // Invites must resolve the same person regardless of typed casing —
    // normalize AFTER isValidRequest (never before: that check must see the
    // raw string) and use the normalized form for both user resolution and
    // the derived display name.
    const email = parsed.email.toLowerCase();
    const invitee = await createUser(email, parsed.displayName ?? displayNameFromEmail(email));
    await putMembership(channelId, invitee.id);

    const response: InviteMemberResponse = {
      member: {
        userId: invitee.id,
        email: invitee.email,
        displayName: invitee.displayName,
        hasDrawnToday: false,
      },
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
