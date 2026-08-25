/**
 * POST /auth/login — unauthenticated. Validates BOTH email and displayName:
 * looks the user up by email, then confirms the stored displayName matches the
 * request's (case-insensitive, trimmed). A miss on either returns 404
 * "user_not_found". Still no passwords in the POC, but the name check makes
 * login a two-field credential match rather than an email-only lookup.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, LoginRequest, LoginResponse } from "@scribl/shared/api";
import { getUserByEmail } from "../data";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isValidRequest(parsed: LoginRequest | undefined): parsed is LoginRequest {
  if (!parsed) {
    return false;
  }
  return (
    typeof parsed.email === "string" &&
    parsed.email.trim().length > 0 &&
    typeof parsed.displayName === "string" &&
    parsed.displayName.trim().length > 0
  );
}

/** Trim + lowercase for case-insensitive credential matching. */
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    let parsed: LoginRequest | undefined;
    try {
      parsed = event.body ? (JSON.parse(event.body) as LoginRequest) : undefined;
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

    const user = await getUserByEmail(parsed.email);
    if (!user || normalize(user.displayName) !== normalize(parsed.displayName)) {
      const error: ApiError = {
        error: "user_not_found",
        message: "no account matches that email and name",
      };
      return jsonResponse(404, error);
    }

    const response: LoginResponse = { user };
    return jsonResponse(200, response);
  } catch (err) {
    const error: ApiError = {
      error: "internal_error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
    return jsonResponse(500, error);
  }
}
