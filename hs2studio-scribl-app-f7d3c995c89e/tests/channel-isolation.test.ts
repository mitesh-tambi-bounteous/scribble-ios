/**
 * channel-isolation — AC4 / ADR 0007.
 *
 * Launch-blocking (AC4): a non-member channel read is denied at the data /
 * API layer, not through a client-side guard. These tests call the Lambda
 * handlers directly (as API Gateway would invoke them) and assert on the
 * HTTP status / body the handler returns. The gate must be driven by a
 * server-side membership record (getMembership), never by anything the
 * caller supplies in the request.
 *
 * Fixtures are built in-test (two users, two channels) against the mock
 * backend's write overlay (submitHandler grants membership as a side
 * effect) — no seed data is relied on.
 *
 * See .claude/skills/channel-isolation-testing/SKILL.md for the full spec.
 */
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as channelResponsesHandler } from "@/backend/lambda/handlers/channel-responses";
import { handler as channelMembersHandler } from "@/backend/lambda/handlers/channel-members";
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

/** Submits USER to CHANNEL for prompt P with TEXT, granting membership as a side effect. */
async function submit(user: string, channel: string, promptId: string, text: string) {
  const result = asStructured(
    await submitHandler(
      makeEvent({ userId: user, body: { promptId, channelIds: [channel], text } }),
    ),
  );
  expect(result.statusCode).toBe(200);
}

describe("channel-isolation (AC4) — server-side membership authz on channel-responses read", () => {
  const CHANNEL_1 = "channel-alpha";
  const CHANNEL_2 = "channel-beta";

  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("non-member read denied: a user who submitted to channel-alpha gets 403 reading channel-beta, with no peer content leaked", async () => {
    const USER = "user-nonmember";

    // Submit to channel-1 first so AC2 passes and the 403 below is isolated
    // to the AC4 membership gate, not the AC2 submit-to-unlock gate.
    await submit(USER, CHANNEL_1, P1, "my art");

    const readResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(readResult.statusCode).toBe(403);
    expect(readResult.body as string).not.toContain("The ceiling fan.");
  });

  it("member read allowed: alice, a member of channel-alpha with a submission, gets 200 with channel-alpha peer responses", async () => {
    const ALICE = "user-alice";
    const BOB = "user-bob";

    await submit(ALICE, CHANNEL_1, P1, "A very sleepy cat.");
    await submit(BOB, CHANNEL_1, P1, "A wobbly dog.");

    const readResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_1 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(readResult.statusCode).toBe(200);
    const body = parseBody(readResult.body);
    expect(Array.isArray(body.responses)).toBe(true);
    expect(body.responses.length).toBeGreaterThan(0);
    expect(
      body.responses.some((r: { text?: string }) => r.text === "A very sleepy cat."),
    ).toBe(true);
  });

  it("cross-channel non-leak: bob, a member of channel-beta with a submission, reads channel-beta and does not see alice's channel-alpha response", async () => {
    const ALICE = "user-alice";
    const BOB = "user-bob";

    await submit(ALICE, CHANNEL_1, P1, "A very sleepy cat.");
    await submit(BOB, CHANNEL_2, P1, "The ceiling fan.");

    const readResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: BOB,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(readResult.statusCode).toBe(200);
    expect(readResult.body as string).not.toContain("A very sleepy cat.");
  });

  it("spoofed membership still denied: a client-supplied member=true claim with no server-side membership record for channel-beta is still 403", async () => {
    const USER = "user-spoofer";

    // Submit to channel-1 first so AC2 passes; USER is now a member of
    // channel-1 only, never channel-2.
    await submit(USER, CHANNEL_1, P1, "my art");

    const readResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1, member: "true" },
          body: { member: true },
        }),
      ),
    );

    expect(readResult.statusCode).toBe(403);
  });
});

describe("channel-isolation (AC4) — members roster carries no cross-channel response leak", () => {
  const CHANNEL_1 = "channel-alpha";
  const CHANNEL_2 = "channel-beta";
  const OTHER_PROMPT = "prompt-2999-01-01";

  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("every returned member.response is scoped to the requested channel", async () => {
    const ALICE = "user-alice";
    const BOB = "user-bob";

    // Both submit to channel-alpha AND channel-beta for P1, so each has a
    // response in BOTH channels. The channel-beta roster must only ever
    // surface the channel-beta response, never the channel-alpha one.
    await submit(ALICE, CHANNEL_1, P1, "alice alpha");
    await submit(ALICE, CHANNEL_2, P1, "alice beta");
    await submit(BOB, CHANNEL_1, P1, "bob alpha");
    await submit(BOB, CHANNEL_2, P1, "bob beta");

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const { members } = parseBody(result.body);
    expect(members.length).toBeGreaterThan(0);
    for (const member of members) {
      if (member.response) {
        expect(member.response.channelId).toBe(CHANNEL_2);
      }
    }
    // And no channel-alpha response body leaked into the channel-beta roster.
    expect(result.body as string).not.toContain("alice alpha");
    expect(result.body as string).not.toContain("bob alpha");
  });

  it("non-member roster read is still 403", async () => {
    const USER = "user-nonmember-roster";
    await submit(USER, CHANNEL_1, P1, "my art"); // member of channel-alpha only

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });

  it("member-but-unsubmitted roster read is still 403", async () => {
    const USER = "user-unsubmitted-roster";
    // Join channel-beta via a DIFFERENT prompt, then read against P1 with no
    // P1 submission recorded.
    await submit(USER, CHANNEL_2, OTHER_PROMPT, "old art");

    const result = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_submitted");
  });
});
