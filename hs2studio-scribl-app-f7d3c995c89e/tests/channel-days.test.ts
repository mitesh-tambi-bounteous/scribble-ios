/**
 * channel-days — GET /channels/{id}/days (AC4-gated, NOT AC2-gated).
 *
 * The day list is metadata only (promptId/isoDate/responseCount); it must
 * never leak response/art content. A non-member is still denied at the
 * data/API layer (AC4). Unlike channel-responses/channel-members, a member
 * with NO submission for a given prompt still gets the day listed here
 * (counts only) — but reading that day's actual content via
 * channel-members/channel-responses stays AC2-gated (NotSubmittedError /
 * 403 not_submitted), proving the days-list does not bypass submit-to-unlock
 * for content.
 *
 * Fixtures are built in-test against the mock backend's write overlay
 * (submitHandler grants membership + records a submission as a side
 * effect) — no seed data is relied on.
 */
import { handler as channelDaysHandler } from "@/backend/lambda/handlers/channel-days";
import { handler as channelMembersHandler } from "@/backend/lambda/handlers/channel-members";
import { handler as submitHandler } from "@/backend/lambda/handlers/submit";
import {
  resetMockSubmissions,
  resetMockMemberships,
  resetMockResponses,
} from "@/backend/lambda/data/dynamodb-client";
import { promptIdForDate } from "@/backend/seeds/seed-data";

type EventArg = Parameters<typeof channelDaysHandler>[0];
type ResultV2 = Awaited<ReturnType<typeof channelDaysHandler>>;
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

/** Submits USER to CHANNEL for prompt P with TEXT, granting membership as a side effect. */
async function submit(user: string, channel: string, promptId: string, text = "my art") {
  const result = asStructured(
    await submitHandler(
      makeEvent({ userId: user, body: { promptId, channelIds: [channel], text } }),
    ),
  );
  expect(result.statusCode).toBe(200);
}

describe("channel-days (AC4) — server-side membership authz, no AC2 gate on metadata", () => {
  const CHANNEL_1 = "channel-alpha";
  const today = new Date().toISOString().slice(0, 10);
  const P_TODAY = promptIdForDate(today);
  const P_YESTERDAY = "prompt-2026-06-30";
  const P_2DAYS_AGO = "prompt-2026-06-29";

  beforeEach(() => {
    resetMockSubmissions();
    resetMockMemberships();
    resetMockResponses();
  });

  it("non-member -> 403 not_a_member", async () => {
    const OUTSIDER = "user-outsider";
    // Outsider has never submitted / joined channel-alpha.
    const result = asStructured(
      await channelDaysHandler(
        makeEvent({ userId: OUTSIDER, pathParameters: { id: CHANNEL_1 } }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });

  it("member -> 200 with distinct days, correct responseCount, newest-first, and NO art/response content", async () => {
    const ALICE = "user-alice";
    const BOB = "user-bob";

    await submit(ALICE, CHANNEL_1, P_2DAYS_AGO, "the ceiling fan");
    await submit(ALICE, CHANNEL_1, P_YESTERDAY, "a wobbly dog");
    await submit(BOB, CHANNEL_1, P_YESTERDAY, "a sleepy cat");
    await submit(ALICE, CHANNEL_1, P_TODAY, "a very tall tree");

    const result = asStructured(
      await channelDaysHandler(
        makeEvent({ userId: ALICE, pathParameters: { id: CHANNEL_1 } }),
      ),
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result.body);
    expect(Array.isArray(body.days)).toBe(true);

    const promptIds = body.days.map((d: { promptId: string }) => d.promptId);
    expect(promptIds).toEqual([P_TODAY, P_YESTERDAY, P_2DAYS_AGO]); // newest-first

    const yesterday = body.days.find((d: { promptId: string }) => d.promptId === P_YESTERDAY);
    expect(yesterday.responseCount).toBe(2);
    const twoDaysAgo = body.days.find((d: { promptId: string }) => d.promptId === P_2DAYS_AGO);
    expect(twoDaysAgo.responseCount).toBe(1);

    // Metadata only — no response text/art leaked into the days payload.
    expect(result.body as string).not.toContain("the ceiling fan");
    expect(result.body as string).not.toContain("a wobbly dog");
    expect(result.body as string).not.toContain("a sleepy cat");
    expect(result.body as string).not.toContain("a very tall tree");
    for (const day of body.days) {
      expect(Object.keys(day).sort()).toEqual(["isoDate", "promptId", "responseCount"]);
    }
  });

  it("days-list does not leak content: per-day art path is still AC2-gated for a member who has NOT submitted that prompt", async () => {
    const ALICE = "user-alice";
    const BOB = "user-bob";

    // Alice joins channel-alpha via a submission to P_YESTERDAY only; Bob
    // submits to P_TODAY so the day exists in the list.
    await submit(ALICE, CHANNEL_1, P_YESTERDAY, "a wobbly dog");
    await submit(BOB, CHANNEL_1, P_TODAY, "a very tall tree");

    // The days list shows P_TODAY exists (metadata only) even though Alice
    // hasn't submitted to it.
    const daysResult = asStructured(
      await channelDaysHandler(makeEvent({ userId: ALICE, pathParameters: { id: CHANNEL_1 } })),
    );
    expect(daysResult.statusCode).toBe(200);
    const promptIds = parseBody(daysResult.body).days.map((d: { promptId: string }) => d.promptId);
    expect(promptIds).toContain(P_TODAY);

    // But reading that day's actual content (roster/art) via
    // channel-members is still AC2-gated: Alice has no P_TODAY submission,
    // so she gets 403 not_submitted, never the content.
    const membersResult = asStructured(
      await channelMembersHandler(
        makeEvent({
          userId: ALICE,
          pathParameters: { id: CHANNEL_1 },
          queryStringParameters: { promptId: P_TODAY },
        }),
      ),
    );
    expect(membersResult.statusCode).toBe(403);
    expect(parseBody(membersResult.body).error).toBe("not_submitted");
    expect(membersResult.body as string).not.toContain("a very tall tree");
  });

  it("spoofed membership still denied: a client-supplied member=true claim with no server-side record is still 403", async () => {
    const CHANNEL_2 = "channel-beta";
    const USER = "user-spoofer-days";
    await submit(USER, CHANNEL_1, P_TODAY); // member of channel-alpha only

    const result = asStructured(
      await channelDaysHandler(
        makeEvent({
          userId: USER,
          pathParameters: { id: CHANNEL_2 },
          queryStringParameters: { member: "true" },
          body: { member: true },
        }),
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(parseBody(result.body).error).toBe("not_a_member");
  });
});
