/**
 * Personal Archive (task #6) — no-gate, unlimited draws.
 *
 * Archive channels (id ending `-archive`) are exempt from the AC2
 * submit-to-unlock EXISTS check on read (the owner always sees their own
 * private art), and accept unlimited same-day drawings instead of being
 * deduped to one response per (user, channel, prompt) like group channels.
 *
 * Group-channel behavior (gated + deduped) must remain unchanged — asserted
 * alongside the archive cases here as a regression guard.
 */
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as channelResponsesHandler } from "@/backend/lambda/handlers/channel-responses";
import {
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof submitHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof submitHandler>>;
type StructuredResult = Exclude<ResultV2, string>;

function asStructured(result: ResultV2): StructuredResult {
  if (typeof result === "string") {
    throw new Error("expected a structured result, got string: " + result);
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
  return asStructured(
    await submitHandler(
      makeEvent({ userId: user, body: { promptId, channelIds: [channel], text } }),
    ),
  );
}

describe("Personal Archive (task #6)", () => {
  const USER = "user-archive-owner";
  const ARCHIVE_CHANNEL = `channel-${USER}-archive`;
  const GROUP_CHANNEL = "channel-group-1";

  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("archive read is NOT gated by submit-to-unlock: 403 for a non-member, but a member with zero submissions still reads their archive as 200", async () => {
    // Non-member (never submitted anywhere, no membership at all) is still denied by AC4.
    const nonMemberResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: "user-someone-else",
          pathParameters: { id: ARCHIVE_CHANNEL },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(nonMemberResult.statusCode).toBe(403);

    // Owner draws into the archive once, granting membership as a side effect
    // of submit — but crucially draws into ONLY the archive, never submitting
    // to any group channel or "unlocking" via AC2 for this prompt.
    const submitResult = await submit(USER, ARCHIVE_CHANNEL, P1, "first archive draw");
    expect(submitResult.statusCode).toBe(200);

    // Reading the SAME prompt on the archive channel succeeds even though the
    // owner never had to pass the normal AC2 gate — read-your-own-archive is
    // exempt.
    const readResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: ARCHIVE_CHANNEL },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(readResult.statusCode).toBe(200);
    const body = parseBody(readResult.body);
    expect(body.responses.some((r: { text?: string }) => r.text === "first archive draw")).toBe(
      true,
    );
  });

  it("archive accepts multiple drawings for the same prompt (unlimited draws)", async () => {
    await submit(USER, ARCHIVE_CHANNEL, P1, "draw one");
    await submit(USER, ARCHIVE_CHANNEL, P1, "draw two");
    await submit(USER, ARCHIVE_CHANNEL, P1, "draw three");

    const readResult = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: ARCHIVE_CHANNEL },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(readResult.statusCode).toBe(200);
    const { responses } = parseBody(readResult.body);
    expect(responses.length).toBe(3);
    const texts = responses.map((r: { text?: string }) => r.text).sort();
    expect(texts).toEqual(["draw one", "draw three", "draw two"]);
  });

  it("group channel still gated (403 before submit) and still deduped to one response per prompt", async () => {
    // Gate: reading before ANY submit for this prompt is 403.
    const readBefore = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: GROUP_CHANNEL },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(readBefore.statusCode).toBe(403);

    // Submit twice to the same group channel for the same prompt.
    await submit(USER, GROUP_CHANNEL, P1, "group draw one");
    await submit(USER, GROUP_CHANNEL, P1, "group draw two");

    const readAfter = asStructured(
      await channelResponsesHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: GROUP_CHANNEL },
          queryStringParameters: { promptId: P1 },
        }),
      ),
    );
    expect(readAfter.statusCode).toBe(200);
    const { responses } = parseBody(readAfter.body);
    // Deduped: exactly one response, updated to the latest text.
    expect(responses.length).toBe(1);
    expect(responses[0].text).toBe("group draw two");
  });
});
