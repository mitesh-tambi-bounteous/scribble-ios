/**
 * challenge-entry - POST /challenges/{cid}/entries.
 *
 * Covers the membership gate and the duplicate-entry gate, all server-side
 * against the mock data layer. Challenges are open-ended (no deadline), so
 * there is no closed gate to cover.
 */
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as challengeCreateHandler } from "@/backend/lambda/handlers/challenge-create";
import { handler as challengeEntryHandler } from "@/backend/lambda/handlers/challenge-entry";
import {
  resetMockChallenges,
  resetMockMemberships,
  resetMockSubmissions,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof challengeEntryHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof challengeEntryHandler>>;
type StructuredResult = Exclude<ResultV2, string>;

function asStructured(result: ResultV2): StructuredResult {
  if (typeof result === "string") {
    throw new Error("expected a structured result ({ statusCode, body }), got string: " + result);
  }
  return result;
}

function makeEvent(opts: {
  userId?: string;
  pathParameters?: Record<string, string>;
  body?: unknown;
}): EventArg {
  return {
    headers: opts.userId ? { "x-user-id": opts.userId } : {},
    pathParameters: opts.pathParameters,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as EventArg;
}

function parseBody(body: string | undefined): any {
  return JSON.parse(body as string);
}

async function submit(user: string, channel: string, promptId: string, text: string) {
  const result = asStructured(
    await submitHandler(
      makeEvent({ userId: user, body: { promptId, channelIds: [channel], text } }) as any,
    ),
  );
  expect(result.statusCode).toBe(200);
}

const VALID_TOOLSET = { brushes: ["basic"], colors: ["#000000"] };

async function createChallengeViaHandler(creator: string, channel: string, word: string) {
  const result = asStructured(
    await challengeCreateHandler(
      makeEvent({
        userId: creator,
        pathParameters: { id: channel },
        body: { word, drawSeconds: 120, toolset: VALID_TOOLSET },
      }),
    ),
  );
  expect(result.statusCode).toBe(200);
  return parseBody(result.body).challenge.id as string;
}

describe("challenge-entry (POST /challenges/{cid}/entries)", () => {
  const CHANNEL = "channel-entry-test";
  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockChallenges();
    resetMockMemberships();
    resetMockSubmissions();
    resetMockResponses();
  });

  it("denies a non-member with 403 not_a_member", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const challengeId = await createChallengeViaHandler("user-member", CHANNEL, "castle");

    const result = asStructured(
      await challengeEntryHandler(
        makeEvent({ userId: "user-outsider", pathParameters: { cid: challengeId }, body: {} }),
      ),
    );
    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });

  it("returns 404 not_found for an unknown challenge id", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const result = asStructured(
      await challengeEntryHandler(
        makeEvent({ userId: "user-member", pathParameters: { cid: "no-such-challenge" }, body: {} }),
      ),
    );
    expect(result.statusCode).toBe(404);
    expect(parseBody(result.body).error).toBe("not_found");
  });

  it("allows a member to submit an entry with 200", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const challengeId = await createChallengeViaHandler("user-member", CHANNEL, "castle");

    const result = asStructured(
      await challengeEntryHandler(
        makeEvent({
          userId: "user-member",
          pathParameters: { cid: challengeId },
          body: { imageRef: "ref-1" },
        }),
      ),
    );
    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(body.entry.challengeId).toBe(challengeId);
    expect(body.entry.userId).toBe("user-member");
  });

  it("rejects a second submission by the same user with 409 already_submitted", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const challengeId = await createChallengeViaHandler("user-member", CHANNEL, "castle");

    const first = asStructured(
      await challengeEntryHandler(
        makeEvent({ userId: "user-member", pathParameters: { cid: challengeId }, body: {} }),
      ),
    );
    expect(first.statusCode).toBe(200);

    const second = asStructured(
      await challengeEntryHandler(
        makeEvent({ userId: "user-member", pathParameters: { cid: challengeId }, body: {} }),
      ),
    );
    expect(second.statusCode).toBe(409);
    expect(parseBody(second.body).error).toBe("already_submitted");
  });

  it("never closes: a challenge accepts entries indefinitely (open-ended, no deadline)", async () => {
    await submit("user-member", CHANNEL, P1, "joining");
    const challengeId = await createChallengeViaHandler("user-member", CHANNEL, "castle");

    const result = asStructured(
      await challengeEntryHandler(
        makeEvent({ userId: "user-member", pathParameters: { cid: challengeId }, body: {} }),
      ),
    );
    expect(result.statusCode).toBe(200);
    expect(parseBody(result.body).error).toBeUndefined();
  });
});
