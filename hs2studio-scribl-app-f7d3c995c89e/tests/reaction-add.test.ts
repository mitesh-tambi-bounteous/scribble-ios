/**
 * reaction-add — AC2 (submit-to-unlock) + AC4 (channel isolation) on the
 * POST /channels/{id}/responses/{responseId}/reactions write path.
 *
 * Reactions are peer-content-adjacent writes: adding a reaction reveals (via
 * the 403 vs 200 split) whether the caller is a member and has submitted, so
 * this write must be gated identically to channel-responses.ts.
 */
import { handler as reactionAddHandler } from "@/backend/lambda/handlers/reaction-add";
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as channelResponsesHandler } from "@/backend/lambda/handlers/channel-responses";
import {
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof reactionAddHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof reactionAddHandler>>;
type StructuredResult = Exclude<ResultV2, string>;

function asStructured(result: ResultV2): StructuredResult {
  if (typeof result === "string") {
    throw new Error(
      "expected a structured result ({ statusCode, body }), got string: " + result,
    );
  }
  return result;
}

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

async function submit(user: string, channel: string, promptId: string, text: string) {
  const result = asStructured(
    await submitHandler(
      makeEvent({ userId: user, body: { promptId, channelIds: [channel], text } }),
    ),
  );
  expect(result.statusCode).toBe(200);
}

describe("reaction-add (AC4 then AC2) — server-side gates on the reaction write", () => {
  const CHANNEL_1 = "channel-alpha";
  const CHANNEL_2 = "channel-beta";

  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("non-member -> 403 not_a_member: user submitted only to channel-alpha, reacts on channel-beta", async () => {
    const USER = "user-reactor-nonmember";
    await submit(USER, CHANNEL_1, P1, "my art");

    const result = asStructured(
      await reactionAddHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL_2, responseId: "response-does-not-matter" },
          queryStringParameters: { promptId: P1 },
          body: { emoji: "🎨" },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });

  it("member without submission -> 403 not_submitted", async () => {
    const USER = "user-reactor-nosub";
    const OTHER_PROMPT = "prompt-2999-01-01";
    await submit(USER, CHANNEL_2, OTHER_PROMPT, "old art");

    const result = asStructured(
      await reactionAddHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL_2, responseId: "response-does-not-matter" },
          queryStringParameters: { promptId: P1 },
          body: { emoji: "🎨" },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_submitted");
  });

  it("member with submission -> 200, reaction persisted and returned on a re-read", async () => {
    const ALICE = "user-alice-reactor";
    const BOB = "user-bob-reactor";

    await submit(ALICE, CHANNEL_1, P1, "A very sleepy cat.");
    await submit(BOB, CHANNEL_1, P1, "A wobbly dog.");

    const listResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_1 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    const bobResponse = parseBody(listResult.body).responses.find(
      (r: { authorId: string }) => r.authorId === BOB,
    );
    expect(bobResponse).toBeDefined();

    const reactResult = asStructured(
      await reactionAddHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_1, responseId: bobResponse.id },
          queryStringParameters: { promptId: P1 },
          body: { emoji: "🎨" },
        }),
      ),
    );

    expect(reactResult.statusCode).toBe(200);
    const body = parseBody(reactResult.body);
    expect(body.response.id).toBe(bobResponse.id);
    expect(
      body.response.reactions.some(
        (r: { userId: string; emoji: string }) => r.userId === ALICE && r.emoji === "🎨",
      ),
    ).toBe(true);
  });

  it("spoofed membership still denied: client-supplied member=true with no server-side record is still 403", async () => {
    const USER = "user-reactor-spoofer";
    await submit(USER, CHANNEL_1, P1, "my art");

    const result = asStructured(
      await reactionAddHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL_2, responseId: "response-does-not-matter" },
          queryStringParameters: { promptId: P1, member: "true" },
          body: { emoji: "🎨", member: true },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });

  it("self-reaction -> 403 cannot_react_own: user cannot react to their own response", async () => {
    const ALICE = "user-alice-self";
    await submit(ALICE, CHANNEL_1, P1, "A very sleepy cat.");

    const listResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_1 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    const ownResponse = parseBody(listResult.body).responses.find(
      (r: { authorId: string }) => r.authorId === ALICE,
    );
    expect(ownResponse).toBeDefined();

    const reactResult = asStructured(
      await reactionAddHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_1, responseId: ownResponse.id },
          queryStringParameters: { promptId: P1 },
          body: { emoji: "🎨" },
        }),
      ),
    );

    expect(reactResult.statusCode).toBe(403);
    expect(parseBody(reactResult.body).error).toBe("cannot_react_own");

    const recheckResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_1 },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    const recheckedOwn = parseBody(recheckResult.body).responses.find(
      (r: { id: string }) => r.id === ownResponse.id,
    );
    expect(recheckedOwn.reactions).toEqual(ownResponse.reactions);
  });

  it("invalid body (missing emoji) -> 400 invalid_request", async () => {
    const USER = "user-reactor-badbody";
    await submit(USER, CHANNEL_1, P1, "my art");

    const result = asStructured(
      await reactionAddHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL_1, responseId: "response-does-not-matter" },
          queryStringParameters: { promptId: P1 },
          body: {},
        }),
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(parseBody(result.body).error).toBe("invalid_request");
  });
});
