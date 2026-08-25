/**
 * GET /users — unauthenticated (POC user picker).
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ApiError, ListUsersResponse } from "@scribl/shared/api";
import { listUsers } from "../data";

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function handler(
  _event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const users = await listUsers();
    const response: ListUsersResponse = { users: [...users] };
    return jsonResponse(200, response);
  } catch (err) {
    const error: ApiError = {
      error: "internal_error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
    return jsonResponse(500, error);
  }
}
