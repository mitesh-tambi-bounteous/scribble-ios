/**
 * POST /auth/signup — unauthenticated. Creates a user (idempotent on email)
 * and provisions their Personal Archive channel.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, SignUpRequest, SignUpResponse } from "@scribl/shared/api";
import { createChannel, createUser } from "../data";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Per-user channel auto-provisioned on signup (AC "channel picker
 * non-empty"). Id is deterministic (derived from the user id) so signup
 * stays idempotent on email/user: re-signup calls createChannel with the
 * same id and relies on its ON CONFLICT / mock upsert semantics to avoid
 * duplicating rows or erroring. "Personal Archive" is a private solo
 * journal — only the owner is ever a member, no invites.
 *
 * BF-13: Family/Friends/Co-Workers are NO LONGER auto-provisioned here — new
 * users start with exactly Personal Archive. Those group channels remain
 * creatable later via POST /walls; they are just not seeded at signup time
 * anymore.
 */
function personalChannelSpecs(
  userId: string,
): { id: string; name: string }[] {
  return [{ id: `channel-${userId}-archive`, name: "Personal Archive" }];
}

function isValidRequest(parsed: SignUpRequest | undefined): parsed is SignUpRequest {
  if (!parsed) {
    return false;
  }
  if (typeof parsed.email !== "string" || parsed.email.trim().length === 0) {
    return false;
  }
  if (typeof parsed.displayName !== "string" || parsed.displayName.trim().length === 0) {
    return false;
  }
  return true;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    let parsed: SignUpRequest | undefined;
    try {
      parsed = event.body ? (JSON.parse(event.body) as SignUpRequest) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!isValidRequest(parsed)) {
      const error: ApiError = {
        error: "invalid_request",
        message: "email and displayName (non-empty strings) are required",
      };
      return jsonResponse(400, error);
    }

    const user = await createUser(parsed.email, parsed.displayName);

    for (const spec of personalChannelSpecs(user.id)) {
      await createChannel(spec.name, "group", false, user.id, undefined, spec.id);
    }

    const response: SignUpResponse = { user };
    return jsonResponse(200, response);
  } catch (err) {
    const error: ApiError = {
      error: "internal_error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
    return jsonResponse(500, error);
  }
}
