/**
 * Stubbed caller identity for the POC. Production swaps this for Cognito
 * (out of scope here). The caller is derived from the `x-user-id` request
 * header; there is no demo-user fallback — the app always sends this header
 * post-login, so an absent/empty header means unauthenticated.
 */
import type { APIGatewayProxyEventV2 } from "aws-lambda";

/**
 * Thrown when the caller identity header is missing/empty. Distinct from a
 * generic internal error so handlers can map it to HTTP 401 (not 500).
 */
export class UnauthenticatedError extends Error {
  constructor(message = "unauthenticated: missing x-user-id") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export function getCallerUserId(event: APIGatewayProxyEventV2): string {
  const headers = event.headers ?? {};
  const headerUserId = headers["x-user-id"] ?? headers["X-User-Id"];
  if (!headerUserId || headerUserId.length === 0) {
    throw new UnauthenticatedError();
  }
  return headerUserId;
}
