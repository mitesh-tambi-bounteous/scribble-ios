/**
 * Minimal local API runner for the Scribl POC backend.
 *
 * Maps the route contract to the Lambda handlers by constructing a minimal
 * APIGatewayProxyEventV2 (path, method, pathParameters, queryStringParameters,
 * headers incl x-user-id, body) and writing back the handler's
 * {statusCode, headers, body}. Lets the Expo web app hit a real server
 * without a deploy. Reads DATABASE_URL from the environment.
 *
 * Run: `npm run api` (from backend/), or `ts-node backend/local-server.ts`
 * from the repo root.
 */
import * as path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

import * as http from "node:http";
import { URL } from "node:url";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

import { handler as todayPromptHandler } from "./lambda/handlers/today-prompt";
import { handler as promptByDateHandler } from "./lambda/handlers/prompt-by-date";
import { handler as submitHandler } from "./lambda/handlers/submit";
import { handler as channelResponsesHandler } from "./lambda/handlers/channel-responses";
import { handler as authSignupHandler } from "./lambda/handlers/auth-signup";
import { handler as authLoginHandler } from "./lambda/handlers/auth-login";
import { handler as usersListHandler } from "./lambda/handlers/users-list";
import { handler as wallsListHandler } from "./lambda/handlers/walls-list";
import { handler as wallsCreateHandler } from "./lambda/handlers/walls-create";
import { handler as channelMembersHandler } from "./lambda/handlers/channel-members";
import { handler as channelDaysHandler } from "./lambda/handlers/channel-days";
import { handler as channelRosterHandler } from "./lambda/handlers/channel-roster";
import { handler as meStatsHandler } from "./lambda/handlers/me-stats";
import { handler as reactionAddHandler } from "./lambda/handlers/reaction-add";
import { handler as memberAddHandler } from "./lambda/handlers/member-add";
import { handler as memberRemoveHandler } from "./lambda/handlers/member-remove";
import { handler as userUpdateHandler } from "./lambda/handlers/user-update";
import { handler as responseUpdateHandler } from "./lambda/handlers/response-update";
import { handler as challengeCreateHandler } from "./lambda/handlers/challenge-create";
import { handler as challengeListHandler } from "./lambda/handlers/challenge-list";
import { handler as challengeEntryHandler } from "./lambda/handlers/challenge-entry";
import { handler as challengeDetailHandler } from "./lambda/handlers/challenge-detail";
import { handler as challengeRateHandler } from "./lambda/handlers/challenge-rate";
import { handler as transcribeHandler } from "./lambda/handlers/transcribe";

type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

/**
 * GET /health — static readiness probe for the Playwright webServer check.
 * Deliberately does not touch the DB / data layer so it stays green even if
 * SCRIBL_DATA_MODE=postgres and DATABASE_URL is unreachable.
 */
async function healthHandler(): Promise<APIGatewayProxyResultV2> {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
}

interface Route {
  method: string;
  /** Path segments; a segment starting with ":" is a param, e.g. ":id". */
  segments: string[];
  handler: Handler;
}

function route(method: string, pattern: string, handler: Handler): Route {
  return { method, segments: pattern.split("/").filter((s) => s.length > 0), handler };
}

const ROUTES: readonly Route[] = [
  route("GET", "/health", healthHandler),
  route("GET", "/prompt/today", todayPromptHandler),
  route("GET", "/prompt/:date", promptByDateHandler),
  route("POST", "/submit", submitHandler),
  route("POST", "/transcribe", transcribeHandler),
  route("GET", "/channels/:id/responses", channelResponsesHandler),
  route("GET", "/channels/:id/members", channelMembersHandler),
  route("GET", "/channels/:id/days", channelDaysHandler),
  route("GET", "/channels/:id/roster", channelRosterHandler),
  route("POST", "/channels/:id/members", memberAddHandler),
  route("DELETE", "/channels/:id/members", memberRemoveHandler),
  route("POST", "/channels/:id/responses/:responseId/reactions", reactionAddHandler),
  route("PATCH", "/channels/:id/responses/:responseId", responseUpdateHandler),
  route("POST", "/channels/:id/challenges", challengeCreateHandler),
  route("GET", "/channels/:id/challenges", challengeListHandler),
  route("POST", "/challenges/:cid/entries", challengeEntryHandler),
  route("GET", "/challenges/:cid", challengeDetailHandler),
  route("POST", "/challenges/:cid/entries/:eid/ratings", challengeRateHandler),
  route("POST", "/auth/signup", authSignupHandler),
  route("POST", "/auth/login", authLoginHandler),
  route("GET", "/users", usersListHandler),
  route("GET", "/me/stats", meStatsHandler),
  route("GET", "/walls", wallsListHandler),
  route("POST", "/walls", wallsCreateHandler),
  route("PATCH", "/users/:id", userUpdateHandler),
];

function matchRoute(
  method: string,
  pathSegments: string[],
): { route: Route; pathParameters: Record<string, string> } | undefined {
  for (const candidate of ROUTES) {
    if (candidate.method !== method) {
      continue;
    }
    if (candidate.segments.length !== pathSegments.length) {
      continue;
    }
    const pathParameters: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < candidate.segments.length; i += 1) {
      const seg = candidate.segments[i] ?? "";
      const actual = pathSegments[i] ?? "";
      if (seg.startsWith(":")) {
        pathParameters[seg.slice(1)] = decodeURIComponent(actual);
      } else if (seg !== actual) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return { route: candidate, pathParameters };
    }
  }
  return undefined;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function toHeaderMap(rawHeaders: http.IncomingHttpHeaders): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (typeof value === "string") {
      headers[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      const first = value[0];
      if (first !== undefined) {
        headers[key.toLowerCase()] = first;
      }
    }
  }
  return headers;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-user-id",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

async function requestListener(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const method = (req.method ?? "GET").toUpperCase();

  if (method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const pathSegments = url.pathname.split("/").filter((s) => s.length > 0);
  const matched = matchRoute(method, pathSegments);

  if (!matched) {
    res.writeHead(404, { ...CORS_HEADERS, "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", message: `no route for ${method} ${url.pathname}` }));
    return;
  }

  const queryStringParameters: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    queryStringParameters[key] = value;
  }

  const rawBody = await readBody(req);
  const headers = toHeaderMap(req.headers);

  const event = {
    version: "2.0",
    routeKey: `${method} ${matched.route.segments.join("/")}`,
    rawPath: url.pathname,
    headers,
    pathParameters: matched.pathParameters,
    queryStringParameters,
    body: rawBody.length > 0 ? rawBody : undefined,
    requestContext: {
      http: { method },
    },
  } as unknown as APIGatewayProxyEventV2;

  try {
    const result = await matched.route.handler(event);
    if (typeof result === "string") {
      res.writeHead(200, { ...CORS_HEADERS, "content-type": "application/json" });
      res.end(result);
      return;
    }
    const statusCode = result.statusCode ?? 200;
    const resultHeaders = { ...CORS_HEADERS, ...(result.headers ?? {}) } as http.OutgoingHttpHeaders;
    res.writeHead(statusCode, resultHeaders);
    res.end(typeof result.body === "string" ? result.body : JSON.stringify(result.body ?? {}));
  } catch (err) {
    res.writeHead(500, { ...CORS_HEADERS, "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: "internal_error",
        message: err instanceof Error ? err.message : "Unknown error",
      }),
    );
  }
}

const PORT = Number(process.env.PORT ?? 8787);

const server = http.createServer((req, res) => {
  requestListener(req, res).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("unhandled request error", err);
    if (!res.headersSent) {
      res.writeHead(500, CORS_HEADERS);
    }
    res.end();
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`scribl local API listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`SCRIBL_DATA_MODE=${process.env.SCRIBL_DATA_MODE ?? "mock"}`);
});
