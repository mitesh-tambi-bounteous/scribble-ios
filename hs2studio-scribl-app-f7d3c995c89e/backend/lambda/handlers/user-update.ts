/**
 * PATCH /users/{id} - self-only user profile update (S-Settings).
 *
 * The caller may only update their own record: callerId (server-derived from
 * x-user-id, never a client-supplied claim) must equal the path id. Writable
 * fields are displayName/email/avatarColor; at least one must be present.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, UpdateUserRequest, UpdateUserResponse } from "@scribl/shared/api";
import { updateUser } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isValidRequest(parsed: UpdateUserRequest | undefined): parsed is UpdateUserRequest {
  if (!parsed) {
    return false;
  }
  const hasDisplayName = typeof parsed.displayName === "string" && parsed.displayName.trim().length > 0;
  const hasEmail = typeof parsed.email === "string" && parsed.email.trim().length > 0;
  const hasAvatarColor = typeof parsed.avatarColor === "string" && parsed.avatarColor.trim().length > 0;
  const hasAvatarImage = typeof parsed.avatarImage === "string" && parsed.avatarImage.trim().length > 0;
  return hasDisplayName || hasEmail || hasAvatarColor || hasAvatarImage;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const callerId = getCallerUserId(event);
    const id = event.pathParameters?.["id"];

    let parsed: UpdateUserRequest | undefined;
    try {
      parsed = event.body ? (JSON.parse(event.body) as UpdateUserRequest) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!id || id.length === 0 || !isValidRequest(parsed)) {
      const error: ApiError = {
        error: "invalid_request",
        message: "id (path) and at least one of displayName/email/avatarColor (body) are required",
      };
      return jsonResponse(400, error);
    }

    // Self-only gate: the caller may only update their own record
    // (server-derived from x-user-id, never a client-supplied claim).
    if (callerId !== id) {
      const error: ApiError = {
        error: "not_authorized",
        message: "you may only update your own user record",
      };
      return jsonResponse(403, error);
    }

    const user = await updateUser(id, {
      displayName: parsed.displayName,
      email: parsed.email,
      avatarColor: parsed.avatarColor,
      avatarImage: parsed.avatarImage,
    });

    const response: UpdateUserResponse = { user };
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
