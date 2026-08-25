/**
 * challenge-rate - the post-reveal star rating gate proof.
 *
 * Launch-blocking: a caller can only rate an entry once THEY have submitted
 * their own entry (per-viewer submit-to-unlock / AC2 - no global deadline);
 * they can never rate their own entry; stars must be an integer 1..5;
 * re-rating the same entry updates in place (no duplicate rater rows). All
 * gates are server-side against the mock data layer, never a
 * client-supplied flag.
 */
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import { handler as challengeCreateHandler } from "@/backend/lambda/handlers/challenge-create";
import { handler as challengeEntryHandler } from "@/backend/lambda/handlers/challenge-entry";
import { handler as challengeRateHandler } from "@/backend/lambda/handlers/challenge-rate";
import {
  resetMockChallenges,
  resetMockMemberships,
  resetMockSubmissions,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

const VALID_TOOLSET = { brushes: ["basic"], colors: ["#000000"] };

type EventArg = Parameters<typeof challengeRateHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof challengeRateHandler>>;
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

async function submitEntry(user: string, challengeId: string) {
  const result = asStructured(
    await challengeEntryHandler(
      makeEvent({ userId: user, pathParameters: { cid: challengeId }, body: {} }),
    ),
  );
  expect(result.statusCode).toBe(200);
}

async function rate(user: string, challengeId: string, entryId: string, body: unknown) {
  return asStructured(
    await challengeRateHandler(
      makeEvent({
        userId: user,
        pathParameters: { cid: challengeId, eid: entryId },
        body,
      }),
    ),
  );
}

describe("challenge-rate - post-reveal rating gate (server-side)", () => {
  const CHANNEL = "channel-rate-test";
  const today = new Date().toISOString().slice(0, 10);
  const P1 = promptIdForDate(today);

  beforeEach(() => {
    resetMockChallenges();
    resetMockMemberships();
    resetMockSubmissions();
    resetMockResponses();
  });

  async function setupRevealed(): Promise<{ challengeId: string; entryAId: string; entryBId: string }> {
    await submit("user-a", CHANNEL, P1, "a joins");
    await submit("user-b", CHANNEL, P1, "b joins");

    const challengeId = await createChallengeViaHandler("user-a", CHANNEL, "castle");
    await submitEntry("user-a", challengeId);
    await submitEntry("user-b", challengeId);

    return {
      challengeId,
      entryAId: `entry-${challengeId}-user-a`,
      entryBId: `entry-${challengeId}-user-b`,
    };
  }

  it("lets a submitter rate a peer's entry, and re-rating updates in place", async () => {
    const { challengeId, entryBId } = await setupRevealed();

    const first = await rate("user-a", challengeId, entryBId, { stars: 4 });
    expect(first.statusCode).toBe(200);
    const firstEntry = parseBody(first.body).entry;
    expect(firstEntry.myStars).toBe(4);
    expect(firstEntry.averageStars).toBe(4);
    expect(firstEntry.ratingCount).toBe(1);

    const second = await rate("user-a", challengeId, entryBId, { stars: 2 });
    expect(second.statusCode).toBe(200);
    const secondEntry = parseBody(second.body).entry;
    expect(secondEntry.myStars).toBe(2);
    expect(secondEntry.averageStars).toBe(2);
    expect(secondEntry.ratingCount).toBe(1);
  });

  it("denies rating your own entry (403 cannot_rate_own)", async () => {
    const { challengeId, entryAId } = await setupRevealed();

    const result = await rate("user-a", challengeId, entryAId, { stars: 3 });
    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("cannot_rate_own");
  });

  it("denies a member who has not submitted their own entry yet (403 not_submitted)", async () => {
    await submit("user-i", CHANNEL, P1, "i joins");
    await submit("user-j", CHANNEL, P1, "j joins");

    const challengeId = await createChallengeViaHandler("user-i", CHANNEL, "lantern");
    await submitEntry("user-i", challengeId);
    // user-j never submits their own entry.

    const result = await rate("user-j", challengeId, `entry-${challengeId}-user-i`, { stars: 3 });
    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_submitted");
  });

  it.each([0, 6, 3.5, "3" as unknown as number, undefined as unknown as number])(
    "rejects an invalid stars value %p with 400 invalid_request",
    async (badStars) => {
      const { challengeId, entryBId } = await setupRevealed();

      const result = await rate("user-a", challengeId, entryBId, { stars: badStars });
      expect(result.statusCode).toBe(400);
      expect(parseBody(result.body).error).toBe("invalid_request");
    },
  );

  it("denies a non-member (403 not_a_member)", async () => {
    const { challengeId, entryBId } = await setupRevealed();

    const result = await rate("user-outsider", challengeId, entryBId, { stars: 4 });
    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });
});
