/**
 * submit-to-unlock — AC2 / ADR 0007.
 *
 * Launch-blocking (AC2): read-before-submit is denied at the data / API
 * layer, not through a client-side guard. These tests call the Lambda
 * handlers directly (as API Gateway would invoke them) and assert on the
 * HTTP status / body the handler returns. The gate must be driven by a
 * server-side submission record (getSubmission), never by anything the
 * caller supplies in the request.
 *
 * See .claude/skills/submit-to-unlock-invariant/SKILL.md for the full spec.
 */
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as channelResponsesHandler } from "@/backend/lambda/handlers/channel-responses";
import {
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

// Derive handler event/result types locally so this root-level suite needs no
// direct dependency on the "aws-lambda" types (which resolve only from the
// backend/ tree). APIGatewayProxyResultV2 is `structured | string`; Exclude
// narrows it to the structured shape these tests assert against.
type EventArg = Parameters<typeof submitHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof submitHandler>>;
type StructuredResult = Exclude<ResultV2, string>;

/**
 * Handlers here always return the structured shape ({ statusCode, headers,
 * body }); assert that and narrow the union so call sites read `.statusCode` /
 * `.body` directly.
 */
function asStructured(result: ResultV2): StructuredResult {
  if (typeof result === "string") {
    throw new Error(
      "expected a structured result ({ statusCode, body }), got string: " + result,
    );
  }
  return result;
}

/** Builds a minimal APIGatewayProxyEventV2 for the fields handlers read. */
function makeEvent(opts: {
  userId?: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: unknown;
}): EventArg {
  return {
    headers: opts.userId ? { "x-user-id": opts.userId } : {},
    pathParameters: opts.pathParameters,
    queryStringParameters: opts.queryStringParameters,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as EventArg;
}

function parseBody(body: string | undefined): any {
  return JSON.parse(body as string);
}

describe("submit-to-unlock (AC2, ADR 0007) — server-side gate on channel-responses read", () => {
  // Fresh user id with NO seeded submission for any prompt.
  const USER = "user-tester";
  const CHANNEL = "channel-1";

  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);
  const P2 = "prompt-2999-01-01";

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("denies read-before-submit: no submission for the prompt returns 403 and leaks no peer content", async () => {
    const event = makeEvent({
      userId: USER,
      pathParameters: { id: CHANNEL },
      queryStringParameters: { promptId: P1 },
    });

    const result = asStructured(await channelResponsesHandler(event));

    expect(result.statusCode).toBe(403);
    // No peer response body should leak into a denied read.
    expect(result.body as string).not.toContain("A very sleepy cat.");
  });

  it("allows read-after-submit: after POST /submit records a submission, the same read returns 200 with responses", async () => {
    const submitEvent = makeEvent({
      userId: USER,
      body: { promptId: P1, channelIds: [CHANNEL], text: "my art" },
    });
    const submitResult = asStructured(await submitHandler(submitEvent));
    expect(submitResult.statusCode).toBe(200);

    const readEvent = makeEvent({
      userId: USER,
      pathParameters: { id: CHANNEL },
      queryStringParameters: { promptId: P1 },
    });
    const readResult = asStructured(await channelResponsesHandler(readEvent));

    expect(readResult.statusCode).toBe(200);
    const body = parseBody(readResult.body);
    expect(Array.isArray(body.responses)).toBe(true);
    expect(body.responses.length).toBeGreaterThan(0);
    expect(body.responses.some((r: { text?: string }) => r.text === "my art")).toBe(true);
  });

  it("denies a bypass attempt: a client-supplied unlocked=true flag with NO submission recorded is still 403", async () => {
    // Proves the gate is enforced against the server-side submission record
    // (getSubmission), not a client-trusted claim. No submit call precedes
    // this read for USER/P1 in this test.
    const event = makeEvent({
      userId: USER,
      pathParameters: { id: CHANNEL },
      queryStringParameters: { promptId: P1, unlocked: "true" },
      body: { unlocked: true },
    });

    const result = asStructured(await channelResponsesHandler(event));

    expect(result.statusCode).toBe(403);
  });

  it("scopes the unlock per-prompt: a submission for P1 does not unlock P2", async () => {
    const submitEvent = makeEvent({
      userId: USER,
      body: { promptId: P1, channelIds: [CHANNEL], text: "my art" },
    });
    const submitResult = asStructured(await submitHandler(submitEvent));
    expect(submitResult.statusCode).toBe(200);

    const readP2 = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL },
          queryStringParameters: { promptId: P2 },
        }),
      ),
    );
    expect(readP2.statusCode).toBe(403);

    // Contrast: P1 (the prompt actually submitted) is unlocked.
    const readP1 = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(readP1.statusCode).toBe(200);
  });
});
