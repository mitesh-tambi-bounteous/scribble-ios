/**
 * POST /walls — caller identified via x-user-id. Creates a new channel/wall
 * and auto-joins the creator as its first member.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, CreateWallRequest, CreateWallResponse } from "@scribl/shared/api";
import { createChannel } from "../data";
import { getCallerUserId, UnauthenticatedError } from "./identity";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isValidRequest(parsed: CreateWallRequest | undefined): parsed is CreateWallRequest {
  if (!parsed) {
    return false;
  }
  if (typeof parsed.name !== "string" || parsed.name.trim().length === 0) {
    return false;
  }
  if (parsed.kind !== "group" && parsed.kind !== "challenge") {
    return false;
  }
  if (typeof parsed.isPublic !== "boolean") {
    return false;
  }
  return true;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const userId = getCallerUserId(event);

    let parsed: CreateWallRequest | undefined;
    try {
      parsed = event.body ? (JSON.parse(event.body) as CreateWallRequest) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!isValidRequest(parsed)) {
      const error: ApiError = {
        error: "invalid_request",
        message: "name (string), kind ('group' | 'challenge'), and isPublic (boolean) are required",
      };
      return jsonResponse(400, error);
    }

    const wall = await createChannel(
      parsed.name,
      parsed.kind,
      parsed.isPublic,
      userId,
      parsed.familyId,
    );

    const response: CreateWallResponse = { wall };
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
